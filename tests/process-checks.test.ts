import { describe, it, expect, vi } from "vitest";
import {
	checkAnyProcess,
	checkGoogleMeet,
	checkProcess,
	ExecFileFn,
	TEAMS_PROCESS_NAMES,
} from "../src/process-checks";

type Outcome = { exitCode?: number | string; killed?: boolean; stdout?: string };

/** Fake execFile: `results` maps "file arg0 arg1" (or just the file) to an outcome. */
function fakeExec(results: Record<string, Outcome>): ExecFileFn & { calls: string[][] } {
	const calls: string[][] = [];
	const fn = ((file, args, _options, callback) => {
		calls.push([file, ...args]);
		const r = results[[file, ...args].join(" ")] ?? results[file] ?? { exitCode: 1 };
		if (r.exitCode === undefined || r.exitCode === 0) {
			callback(null, r.stdout ?? "", "");
		} else {
			const err = Object.assign(new Error("failed"), { code: r.exitCode, killed: r.killed ?? false });
			callback(err, r.stdout ?? "", "");
		}
	}) as ExecFileFn & { calls: string[][] };
	fn.calls = calls;
	return fn;
}

describe("checkProcess", () => {
	it("is running when pgrep finds the exact name", async () => {
		const exec = fakeExec({ "pgrep -x zoom.us": { exitCode: 0 } });
		await expect(checkProcess(exec, "zoom.us")).resolves.toBe("running");
		expect(exec.calls[0]).toEqual(["pgrep", "-x", "zoom.us"]);
	});

	it("is not running when pgrep finds nothing (exit 1)", async () => {
		await expect(checkProcess(fakeExec({}), "zoom.us")).resolves.toBe("not-running");
	});

	it("is unknown when pgrep itself fails", async () => {
		await expect(checkProcess(fakeExec({ pgrep: { exitCode: 3 } }), "zoom.us")).resolves.toBe("unknown");
		await expect(checkProcess(fakeExec({ pgrep: { exitCode: "ENOENT" } }), "zoom.us")).resolves.toBe(
			"unknown"
		);
	});
});

describe("Teams", () => {
	it("checks the new Teams (MSTeams) and classic Teams (Teams) executables", () => {
		expect(TEAMS_PROCESS_NAMES).toEqual(["MSTeams", "Teams"]);
	});

	it("detects the new Teams", async () => {
		const exec = fakeExec({ "pgrep -x MSTeams": { exitCode: 0 } });
		await expect(checkAnyProcess(exec, TEAMS_PROCESS_NAMES)).resolves.toBe("running");
	});

	it("detects classic Teams", async () => {
		const exec = fakeExec({ "pgrep -x Teams": { exitCode: 0 } });
		await expect(checkAnyProcess(exec, TEAMS_PROCESS_NAMES)).resolves.toBe("running");
	});

	it("is not running only when neither is running", async () => {
		await expect(checkAnyProcess(fakeExec({}), TEAMS_PROCESS_NAMES)).resolves.toBe("not-running");
	});

	it("is unknown when one check failed and the other found nothing", async () => {
		const exec = fakeExec({ "pgrep -x MSTeams": { exitCode: 2 } });
		await expect(checkAnyProcess(exec, TEAMS_PROCESS_NAMES)).resolves.toBe("unknown");
	});
});

describe("checkGoogleMeet", () => {
	it("is running when the script answers true", async () => {
		const exec = fakeExec({ osascript: { stdout: "true\n" } });
		await expect(checkGoogleMeet(exec)).resolves.toBe("running");
		expect(exec.calls[0]?.[0]).toBe("osascript");
		expect(exec.calls[0]?.[1]).toBe("-e");
	});

	it("is not running when the script answers false", async () => {
		await expect(checkGoogleMeet(fakeExec({ osascript: { stdout: "false\n" } }))).resolves.toBe(
			"not-running"
		);
	});

	it("is unknown when osascript times out or is not allowed", async () => {
		await expect(checkGoogleMeet(fakeExec({ osascript: { exitCode: 1, killed: true } }))).resolves.toBe(
			"unknown"
		);
		await expect(checkGoogleMeet(fakeExec({ osascript: { exitCode: 1 } }))).resolves.toBe("unknown");
	});

	it("is unknown for unexpected output", async () => {
		await expect(checkGoogleMeet(fakeExec({ osascript: { stdout: "" } }))).resolves.toBe("unknown");
	});

	it("passes a timeout", async () => {
		const exec = vi.fn<Parameters<ExecFileFn>, void>((_f, _a, _o, cb) => cb(null, "false", ""));
		await checkGoogleMeet(exec as unknown as ExecFileFn);
		expect(exec.mock.calls[0]?.[2].timeout).toBeGreaterThan(0);
	});
});
