import type { ProcessState } from "./process-checks";

export type MeetingApp = "Zoom" | "Google Meet" | "Microsoft Teams";

export interface TrackerOptions {
	/** Consecutive "not-running" results needed before a meeting counts as ended. */
	missesToEnd: number;
	/** Stay silent about apps that were already running at the startup check. */
	ignoreRunningAtStartup: boolean;
}

interface ActiveMeeting {
	misses: number;
	/** Started silently (running at startup), so its end is silent too. */
	silent: boolean;
}

/**
 * Turns per-poll check results into start/end events. A meeting ends only
 * after `missesToEnd` definite misses in a row; "unknown" results never
 * count, so a slow or failing check cannot stop a recording mid-meeting.
 */
export class MeetingTracker {
	private active = new Map<MeetingApp, ActiveMeeting>();
	private dismissed = new Set<MeetingApp>();

	constructor(private readonly options: TrackerOptions) {}

	update(app: MeetingApp, state: ProcessState, isStartupCheck: boolean): "start" | "end" | null {
		if (state === "unknown") return null;
		const meeting = this.active.get(app);

		if (state === "running") {
			if (meeting) {
				meeting.misses = 0;
				return null;
			}
			const silent = this.options.ignoreRunningAtStartup && isStartupCheck;
			this.active.set(app, { misses: 0, silent });
			return silent || this.dismissed.has(app) ? null : "start";
		}

		if (!meeting) return null;
		meeting.misses++;
		if (meeting.misses < Math.max(1, this.options.missesToEnd)) return null;
		this.active.delete(app);
		this.dismissed.delete(app);
		return meeting.silent ? null : "end";
	}

	isActive(app: MeetingApp): boolean {
		return this.active.has(app);
	}

	dismiss(app: MeetingApp): void {
		this.dismissed.add(app);
	}

	/** Forget everything so meetings that are still running are announced again. */
	reset(): void {
		this.active.clear();
		this.dismissed.clear();
	}
}
