import { describe, it, expect, vi } from "vitest";
import {
	getSystemRecordingApi,
	isSystemRecordingEnabled,
	resolveRecorder,
	SYSTEM_RECORDING_ID,
} from "../src/recorder-backend";

function fakeApi(over: Record<string, unknown> = {}) {
	return {
		apiVersion: 1,
		startRecording: vi.fn(async () => true),
		stopRecording: vi.fn(async () => ({ path: "recordings/a.m4a" })),
		isRecording: vi.fn(() => true),
		on: vi.fn(() => () => {}),
		...over,
	};
}

function fakeApp(opts: { enabled?: boolean; api?: unknown; commandResult?: boolean } = {}) {
	const executeCommandById = vi.fn(() => opts.commandResult ?? true);
	const plugin = opts.api === undefined ? {} : { api: opts.api };
	return {
		executeCommandById,
		app: {
			commands: { executeCommandById },
			plugins: {
				enabledPlugins: new Set(opts.enabled ? [SYSTEM_RECORDING_ID] : []),
				plugins: opts.enabled ? { [SYSTEM_RECORDING_ID]: plugin } : {},
			},
		},
	};
}

describe("System Recording detection", () => {
	it("is available only when installed and enabled", () => {
		expect(isSystemRecordingEnabled(fakeApp({ enabled: true }).app)).toBe(true);
		expect(isSystemRecordingEnabled(fakeApp().app)).toBe(false);
		expect(isSystemRecordingEnabled({})).toBe(false);
	});

	it("finds API version 1", () => {
		const api = fakeApi();
		expect(getSystemRecordingApi(fakeApp({ enabled: true, api }).app)).toBe(api);
	});

	it("ignores an API of another version or shape", () => {
		expect(getSystemRecordingApi(fakeApp({ enabled: true, api: fakeApi({ apiVersion: 2 }) }).app)).toBeNull();
		expect(
			getSystemRecordingApi(fakeApp({ enabled: true, api: fakeApi({ startRecording: "nope" }) }).app)
		).toBeNull();
		expect(getSystemRecordingApi(fakeApp({ enabled: false, api: fakeApi() }).app)).toBeNull();
	});
});

describe("resolveRecorder", () => {
	it("uses the core Audio Recorder by default", async () => {
		const { app, executeCommandById } = fakeApp({ enabled: true, api: fakeApi() });
		const { recorder, fellBack } = resolveRecorder(app, "core");
		expect(recorder.kind).toBe("core");
		expect(fellBack).toBe(false);
		await expect(recorder.start({ title: "Sync" })).resolves.toBe(true);
		expect(executeCommandById).toHaveBeenCalledWith("audio-recorder:start");
		await recorder.stop();
		expect(executeCommandById).toHaveBeenCalledWith("audio-recorder:stop");
	});

	it("reports when the core recorder is not available", async () => {
		const { app } = fakeApp({ commandResult: false });
		await expect(resolveRecorder(app, "core").recorder.start({ title: "Sync" })).resolves.toBe(false);
	});

	it("passes the title and note path to the System Recording API", async () => {
		const api = fakeApi();
		const { recorder } = resolveRecorder(fakeApp({ enabled: true, api }).app, "system-recording");
		expect(recorder.kind).toBe("system-recording-api");
		await expect(recorder.start({ title: "Sync", notePath: "Meetings/Sync.md" })).resolves.toBe(true);
		expect(api.startRecording).toHaveBeenCalledWith({ title: "Sync", notePath: "Meetings/Sync.md" });
	});

	it("stops through the API only while it is recording", async () => {
		const api = fakeApi({ isRecording: vi.fn(() => false) });
		const { recorder } = resolveRecorder(fakeApp({ enabled: true, api }).app, "system-recording");
		await expect(recorder.stop()).resolves.toBe(false);
		expect(api.stopRecording).not.toHaveBeenCalled();
		api.isRecording = vi.fn(() => true);
		await expect(recorder.stop()).resolves.toBe(true);
		expect(api.stopRecording).toHaveBeenCalled();
	});

	it("falls back to the System Recording commands on versions without the API", async () => {
		const { app, executeCommandById } = fakeApp({ enabled: true });
		const { recorder, fellBack } = resolveRecorder(app, "system-recording");
		expect(recorder.kind).toBe("system-recording-command");
		expect(fellBack).toBe(false);
		await recorder.start({ title: "Sync" });
		expect(executeCommandById).toHaveBeenCalledWith("system-recording:start-recording");
		await recorder.stop();
		expect(executeCommandById).toHaveBeenCalledWith("system-recording:stop-recording");
	});

	it("falls back to the core recorder when System Recording is not enabled", () => {
		const { recorder, fellBack } = resolveRecorder(fakeApp().app, "system-recording");
		expect(recorder.kind).toBe("core");
		expect(fellBack).toBe(true);
	});

	it("returns false instead of throwing when the API call fails", async () => {
		const api = fakeApi({
			startRecording: vi.fn(async () => {
				throw new Error("boom");
			}),
		});
		const { recorder } = resolveRecorder(fakeApp({ enabled: true, api }).app, "system-recording");
		await expect(recorder.start({ title: "Sync" })).resolves.toBe(false);
	});
});
