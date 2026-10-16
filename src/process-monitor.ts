/* global activeWindow -- Obsidian exposes this on the active (possibly popped-out) window; required by obsidianmd/commands timer rules */
import { execFile } from "child_process";
import {
	checkAnyProcess,
	checkGoogleMeet,
	ExecFileFn,
	ProcessState,
	TEAMS_PROCESS_NAMES,
	ZOOM_PROCESS_NAMES,
} from "./process-checks";
import { MeetingTracker, type MeetingApp } from "./meeting-tracker";
import type { MeetingDetectorSettings } from "./settings";

export type { MeetingApp };

export interface MeetingEvent {
	app: MeetingApp;
	type: "start" | "end";
}

type MeetingCallback = (event: MeetingEvent) => void;

export type MonitorSettings = Pick<
	MeetingDetectorSettings,
	| "pluginEnabled"
	| "enableZoom"
	| "enableGoogleMeet"
	| "enableTeams"
	| "pollingIntervalSeconds"
	| "ignoreRunningAtStartup"
>;

/** 3 misses = 15 seconds at the default 5-second interval. */
export const MISSES_TO_END = 3;

export interface MonitorDeps {
	exec: ExecFileFn;
	setInterval: (handler: () => void, ms: number) => number;
	clearInterval: (id: number) => void;
}

function defaultDeps(): MonitorDeps {
	return {
		exec: execFile as unknown as ExecFileFn,
		setInterval: (handler, ms) => activeWindow.setInterval(handler, ms),
		clearInterval: (id) => activeWindow.clearInterval(id),
	};
}

export class ProcessMonitor {
	private intervalId: number | null = null;
	private tracker: MeetingTracker;
	private callback: MeetingCallback;
	private getSettings: () => MonitorSettings;
	private deps: MonitorDeps;
	private polling = false;
	/** Only the very first poll after the plugin loaded counts as the startup check. */
	private startupCheckDone = false;

	constructor(
		getSettings: () => MonitorSettings,
		callback: MeetingCallback,
		deps: Partial<MonitorDeps> = {}
	) {
		this.getSettings = getSettings;
		this.callback = callback;
		this.deps = { ...defaultDeps(), ...deps };
		this.tracker = new MeetingTracker({
			missesToEnd: MISSES_TO_END,
			get ignoreRunningAtStartup() {
				return getSettings().ignoreRunningAtStartup;
			},
		});
	}

	start(): void {
		if (this.intervalId !== null) return;
		const settings = this.getSettings();
		void this.poll();
		this.intervalId = this.deps.setInterval(
			() => void this.poll(),
			settings.pollingIntervalSeconds * 1000
		);
	}

	stop(): void {
		if (this.intervalId !== null) {
			this.deps.clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	restart(): void {
		this.stop();
		this.start();
	}

	dismiss(app: MeetingApp): void {
		this.tracker.dismiss(app);
	}

	/** "Check for meetings now": announce meetings that are still running again, then poll. */
	async checkNow(): Promise<void> {
		this.tracker.reset();
		this.startupCheckDone = true;
		await this.poll();
	}

	async poll(): Promise<void> {
		const settings = this.getSettings();
		if (!settings.pluginEnabled || this.polling) return;
		this.polling = true;
		try {
			const isStartupCheck = !this.startupCheckDone;
			const checks: Promise<{ app: MeetingApp; state: ProcessState }>[] = [];
			const exec = this.deps.exec;

			if (settings.enableZoom) {
				checks.push(
					checkAnyProcess(exec, ZOOM_PROCESS_NAMES).then((state) => ({ app: "Zoom" as const, state }))
				);
			}
			if (settings.enableTeams) {
				checks.push(
					checkAnyProcess(exec, TEAMS_PROCESS_NAMES).then((state) => ({
						app: "Microsoft Teams" as const,
						state,
					}))
				);
			}
			if (settings.enableGoogleMeet) {
				checks.push(checkGoogleMeet(exec).then((state) => ({ app: "Google Meet" as const, state })));
			}

			const results = await Promise.all(checks);
			this.startupCheckDone = true;

			for (const { app, state } of results) {
				const type = this.tracker.update(app, state, isStartupCheck);
				if (type) this.callback({ app, type });
			}
		} finally {
			this.polling = false;
		}
	}
}
