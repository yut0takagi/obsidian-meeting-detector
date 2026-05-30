/* global activeWindow -- Obsidian exposes this on the active (possibly popped-out) window; required by obsidianmd/commands timer rules */
import { execFile } from "child_process";
import type { MeetingDetectorSettings } from "./settings";

export type MeetingApp = "Zoom" | "Google Meet" | "Microsoft Teams";

export interface MeetingEvent {
	app: MeetingApp;
	type: "start" | "end";
}

type MeetingCallback = (event: MeetingEvent) => void;

const OSASCRIPT_GET_BROWSER_TABS = `
set meetFound to false
tell application "System Events"
	set browserNames to {"Google Chrome", "Brave Browser", "Microsoft Edge", "Arc", "Safari"}
	repeat with browserName in browserNames
		if exists (process browserName) then
			tell application browserName
				try
					if browserName as text is "Safari" then
						repeat with w in windows
							repeat with t in tabs of w
								if name of t contains "Meet" and URL of t contains "meet.google.com" then
									set meetFound to true
									exit repeat
								end if
							end repeat
							if meetFound then exit repeat
						end repeat
					else
						repeat with w in windows
							repeat with t in tabs of w
								if title of t contains "Meet" and URL of t contains "meet.google.com" then
									set meetFound to true
									exit repeat
								end if
							end repeat
							if meetFound then exit repeat
						end repeat
					end if
				end try
			end tell
		end if
		if meetFound then exit repeat
	end repeat
end tell
if meetFound then
	return "true"
else
	return "false"
end if
`;

export class ProcessMonitor {
	private intervalId: number | null = null;
	private activeApps: Set<MeetingApp> = new Set();
	private dismissedApps: Set<MeetingApp> = new Set();
	private callback: MeetingCallback;
	private getSettings: () => MeetingDetectorSettings;

	constructor(
		getSettings: () => MeetingDetectorSettings,
		callback: MeetingCallback
	) {
		this.getSettings = getSettings;
		this.callback = callback;
	}

	start(): void {
		if (this.intervalId) return;
		const settings = this.getSettings();
		void this.poll();
		this.intervalId = activeWindow.setInterval(
			() => void this.poll(),
			settings.pollingIntervalSeconds * 1000
		);
	}

	stop(): void {
		if (this.intervalId) {
			activeWindow.clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	restart(): void {
		this.stop();
		this.start();
	}

	clearDismissed(app?: MeetingApp): void {
		if (app) {
			this.dismissedApps.delete(app);
		} else {
			this.dismissedApps.clear();
		}
	}

	dismiss(app: MeetingApp): void {
		this.dismissedApps.add(app);
	}

	private async poll(): Promise<void> {
		const settings = this.getSettings();
		if (!settings.pluginEnabled) return;

		const checks: Promise<{ app: MeetingApp; running: boolean }>[] = [];

		if (settings.enableZoom) {
			checks.push(
				this.checkProcess("zoom.us").then((running) => ({
					app: "Zoom" as MeetingApp,
					running,
				}))
			);
		}

		if (settings.enableTeams) {
			checks.push(
				this.checkProcess("Teams").then((running) => ({
					app: "Microsoft Teams" as MeetingApp,
					running,
				}))
			);
		}

		if (settings.enableGoogleMeet) {
			checks.push(
				this.checkGoogleMeet().then((running) => ({
					app: "Google Meet" as MeetingApp,
					running,
				}))
			);
		}

		const results = await Promise.all(checks);

		for (const { app, running } of results) {
			const wasActive = this.activeApps.has(app);

			if (running && !wasActive) {
				this.activeApps.add(app);
				if (!this.dismissedApps.has(app)) {
					this.callback({ app, type: "start" });
				}
			} else if (!running && wasActive) {
				this.activeApps.delete(app);
				this.dismissedApps.delete(app);
				this.callback({ app, type: "end" });
			}
		}
	}

	private checkProcess(processName: string): Promise<boolean> {
		return new Promise((resolve) => {
			execFile("pgrep", ["-x", processName], (error) => {
				resolve(!error);
			});
		});
	}

	private checkGoogleMeet(): Promise<boolean> {
		return new Promise((resolve) => {
			execFile(
				"osascript",
				["-e", OSASCRIPT_GET_BROWSER_TABS],
				{ timeout: 5000 },
				(error, stdout) => {
					if (error) {
						resolve(false);
						return;
					}
					resolve(stdout.trim() === "true");
				}
			);
		});
	}
}
