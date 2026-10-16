import { describe, it, expect } from "vitest";
import { MeetingTracker } from "../src/meeting-tracker";

function tracker(over: Partial<ConstructorParameters<typeof MeetingTracker>[0]> = {}) {
	return new MeetingTracker({ missesToEnd: 3, ignoreRunningAtStartup: false, ...over });
}

describe("MeetingTracker start", () => {
	it("reports start once when an app begins running", () => {
		const t = tracker();
		expect(t.update("Zoom", "not-running", false)).toBeNull();
		expect(t.update("Zoom", "running", false)).toBe("start");
		expect(t.update("Zoom", "running", false)).toBeNull();
	});

	it("does not start on an unknown result", () => {
		expect(tracker().update("Google Meet", "unknown", false)).toBeNull();
	});

	it("does not announce an app the user dismissed", () => {
		const t = tracker();
		t.dismiss("Zoom");
		expect(t.update("Zoom", "running", false)).toBeNull();
	});
});

describe("MeetingTracker end (grace period)", () => {
	it("ends only after the configured number of consecutive misses", () => {
		const t = tracker();
		t.update("Zoom", "running", false);
		expect(t.update("Zoom", "not-running", false)).toBeNull();
		expect(t.update("Zoom", "not-running", false)).toBeNull();
		expect(t.update("Zoom", "not-running", false)).toBe("end");
	});

	it("resets the miss count when the app is seen again", () => {
		const t = tracker();
		t.update("Zoom", "running", false);
		t.update("Zoom", "not-running", false);
		t.update("Zoom", "not-running", false);
		t.update("Zoom", "running", false);
		expect(t.update("Zoom", "not-running", false)).toBeNull();
		expect(t.update("Zoom", "not-running", false)).toBeNull();
		expect(t.update("Zoom", "not-running", false)).toBe("end");
	});

	it("never ends on unknown results (e.g. osascript timeouts)", () => {
		const t = tracker();
		t.update("Google Meet", "running", false);
		for (let i = 0; i < 10; i++) expect(t.update("Google Meet", "unknown", false)).toBeNull();
		expect(t.isActive("Google Meet")).toBe(true);
	});

	it("does not count unknown results as misses", () => {
		const t = tracker();
		t.update("Google Meet", "running", false);
		t.update("Google Meet", "not-running", false);
		t.update("Google Meet", "unknown", false);
		t.update("Google Meet", "not-running", false);
		expect(t.update("Google Meet", "unknown", false)).toBeNull();
		expect(t.update("Google Meet", "not-running", false)).toBe("end");
	});

	it("still reports the end of a dismissed meeting and forgets the dismissal", () => {
		const t = tracker({ missesToEnd: 1 });
		t.dismiss("Zoom");
		t.update("Zoom", "running", false);
		expect(t.update("Zoom", "not-running", false)).toBe("end");
		expect(t.update("Zoom", "running", false)).toBe("start");
	});
});

describe("MeetingTracker ignoreRunningAtStartup", () => {
	it("stays silent for apps already running at the startup check, including their end", () => {
		const t = tracker({ ignoreRunningAtStartup: true, missesToEnd: 1 });
		expect(t.update("Zoom", "running", true)).toBeNull();
		expect(t.update("Zoom", "running", false)).toBeNull();
		expect(t.update("Zoom", "not-running", false)).toBeNull();
		// the next launch is announced normally
		expect(t.update("Zoom", "running", false)).toBe("start");
	});

	it("announces apps that start after the startup check", () => {
		const t = tracker({ ignoreRunningAtStartup: true });
		t.update("Zoom", "not-running", true);
		expect(t.update("Zoom", "running", false)).toBe("start");
	});

	it("announces apps running at startup when the option is off", () => {
		expect(tracker().update("Zoom", "running", true)).toBe("start");
	});
});

describe("MeetingTracker reset (Check for meetings now)", () => {
	it("announces meetings that are still running again", () => {
		const t = tracker();
		t.update("Zoom", "running", false);
		t.reset();
		expect(t.update("Zoom", "running", false)).toBe("start");
	});

	it("also announces apps silenced at startup or dismissed", () => {
		const t = tracker({ ignoreRunningAtStartup: true });
		t.update("Zoom", "running", true);
		t.dismiss("Microsoft Teams");
		t.update("Microsoft Teams", "running", false);
		t.reset();
		expect(t.update("Zoom", "running", false)).toBe("start");
		expect(t.update("Microsoft Teams", "running", false)).toBe("start");
	});
});
