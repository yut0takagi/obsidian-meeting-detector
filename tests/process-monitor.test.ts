import { describe, it, expect, vi } from "vitest";
import { ProcessMonitor, MonitorSettings, MeetingEvent } from "../src/process-monitor";
import type { ExecFileFn } from "../src/process-checks";

const SETTINGS: MonitorSettings = {
	pluginEnabled: true,
	enableZoom: true,
	enableGoogleMeet: false,
	enableTeams: true,
	pollingIntervalSeconds: 5,
	ignoreRunningAtStartup: false,
};

/** execFile fake driven by a mutable set of running process names. */
function fakeExec(running: Set<string>): ExecFileFn {
	return (file, args, _options, callback) => {
		if (file === "pgrep") {
			const name = args[1] ?? "";
			if (running.has(name)) callback(null, "", "");
			else callback(Object.assign(new Error("no match"), { code: 1 }), "", "");
			return;
		}
		callback(Object.assign(new Error("unexpected"), { code: 1 }), "", "");
	};
}

function setup(settings: Partial<MonitorSettings> = {}) {
	const running = new Set<string>();
	const events: MeetingEvent[] = [];
	const s = { ...SETTINGS, ...settings };
	const monitor = new ProcessMonitor(
		() => s,
		(e) => events.push(e),
		{ exec: fakeExec(running), setInterval: vi.fn(() => 1), clearInterval: vi.fn() }
	);
	return { running, events, monitor, settings: s };
}

describe("ProcessMonitor", () => {
	it("announces the new Teams (MSTeams process)", async () => {
		const { running, events, monitor } = setup();
		running.add("MSTeams");
		await monitor.poll();
		expect(events).toEqual([{ app: "Microsoft Teams", type: "start" }]);
	});

	it("waits for three misses before announcing the end", async () => {
		const { running, events, monitor } = setup();
		running.add("zoom.us");
		await monitor.poll();
		running.delete("zoom.us");
		await monitor.poll();
		await monitor.poll();
		expect(events).toEqual([{ app: "Zoom", type: "start" }]);
		await monitor.poll();
		expect(events.at(-1)).toEqual({ app: "Zoom", type: "end" });
	});

	it("skips a poll while the previous one is still running", async () => {
		let release: (() => void) | null = null;
		const exec: ExecFileFn = (_f, _a, _o, cb) => {
			release = () => cb(null, "", "");
		};
		const events: MeetingEvent[] = [];
		const monitor = new ProcessMonitor(
			() => ({ ...SETTINGS, enableTeams: false }),
			(e) => events.push(e),
			{ exec, setInterval: vi.fn(() => 1), clearInterval: vi.fn() }
		);
		const first = monitor.poll();
		await monitor.poll(); // returns at once: first is in flight
		(release as unknown as () => void)();
		await first;
		expect(events).toEqual([{ app: "Zoom", type: "start" }]);
	});

	it("treats only the first poll as the startup check", async () => {
		const { running, events, monitor } = setup({ ignoreRunningAtStartup: true });
		running.add("zoom.us");
		await monitor.poll(); // silent: running at startup
		running.add("MSTeams");
		await monitor.poll();
		expect(events).toEqual([{ app: "Microsoft Teams", type: "start" }]);
	});

	it("re-announces running meetings on checkNow()", async () => {
		const { running, events, monitor } = setup({ ignoreRunningAtStartup: true });
		running.add("zoom.us");
		await monitor.poll();
		await monitor.checkNow();
		expect(events).toEqual([{ app: "Zoom", type: "start" }]);
	});

	it("does nothing while the plugin is disabled", async () => {
		const { running, events, monitor } = setup({ pluginEnabled: false });
		running.add("zoom.us");
		await monitor.poll();
		expect(events).toEqual([]);
	});

	it("starts and stops its interval with the configured period", () => {
		const setIntervalFn = vi.fn(() => 7);
		const clearIntervalFn = vi.fn();
		const monitor = new ProcessMonitor(() => SETTINGS, () => {}, {
			exec: fakeExec(new Set()),
			setInterval: setIntervalFn,
			clearInterval: clearIntervalFn,
		});
		monitor.start();
		monitor.start();
		expect(setIntervalFn).toHaveBeenCalledTimes(1);
		expect(setIntervalFn).toHaveBeenCalledWith(expect.any(Function), 5000);
		monitor.stop();
		expect(clearIntervalFn).toHaveBeenCalledWith(7);
	});
});
