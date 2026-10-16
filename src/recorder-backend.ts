/**
 * Where "Start recording" goes: Obsidian's core Audio Recorder (microphone
 * only) or the System Recording plugin (system audio + microphone, so the
 * other side is recorded even with headphones).
 */

export type RecorderChoice = "core" | "system-recording";

export const SYSTEM_RECORDING_ID = "system-recording";

const CORE_START = "audio-recorder:start";
const CORE_STOP = "audio-recorder:stop";
/** Command ids of System Recording 1.0.x, which has no API. */
const SYSTEM_RECORDING_START = `${SYSTEM_RECORDING_ID}:start-recording`;
const SYSTEM_RECORDING_STOP = `${SYSTEM_RECORDING_ID}:stop-recording`;

/** The part of System Recording's `api` (apiVersion 1, from 1.1.0) used here. */
export interface SystemRecordingApi {
	apiVersion: 1;
	startRecording(options?: { title?: string; notePath?: string }): Promise<boolean>;
	stopRecording(): Promise<{ path: string } | null>;
	isRecording(): boolean;
}

export interface RecordingRequest {
	title: string;
	/** The meeting note, so System Recording links the recording there. */
	notePath?: string;
}

export interface Recorder {
	readonly kind: "core" | "system-recording-api" | "system-recording-command";
	/** Resolves false when recording could not be started. */
	start(request: RecordingRequest): Promise<boolean>;
	/** Resolves true when a stop was sent. */
	stop(): Promise<boolean>;
}

/** Obsidian internals used here; not in the public typings. */
interface AppInternals {
	commands?: { executeCommandById(id: string): boolean };
	plugins?: {
		enabledPlugins?: Set<string>;
		plugins?: Record<string, { api?: unknown } | undefined>;
	};
}

function internals(app: unknown): AppInternals {
	return typeof app === "object" && app !== null ? (app as AppInternals) : {};
}

/** True when System Recording is installed and enabled. */
export function isSystemRecordingEnabled(app: unknown): boolean {
	const plugins = internals(app).plugins;
	return !!plugins?.enabledPlugins?.has(SYSTEM_RECORDING_ID) && !!plugins.plugins?.[SYSTEM_RECORDING_ID];
}

export function getSystemRecordingApi(app: unknown): SystemRecordingApi | null {
	if (!isSystemRecordingEnabled(app)) return null;
	const api = internals(app).plugins?.plugins?.[SYSTEM_RECORDING_ID]?.api as
		| Partial<SystemRecordingApi>
		| undefined;
	if (
		api &&
		api.apiVersion === 1 &&
		typeof api.startRecording === "function" &&
		typeof api.stopRecording === "function" &&
		typeof api.isRecording === "function"
	) {
		return api as SystemRecordingApi;
	}
	return null;
}

function commandRecorder(
	app: unknown,
	kind: "core" | "system-recording-command",
	startId: string,
	stopId: string
): Recorder {
	const run = (id: string): boolean => {
		const commands = internals(app).commands;
		return commands ? commands.executeCommandById(id) !== false : false;
	};
	return {
		kind,
		start: async () => run(startId),
		stop: async () => run(stopId),
	};
}

function apiRecorder(api: SystemRecordingApi): Recorder {
	return {
		kind: "system-recording-api",
		start: async ({ title, notePath }) => {
			try {
				return await api.startRecording(notePath ? { title, notePath } : { title });
			} catch {
				return false;
			}
		},
		stop: async () => {
			if (!api.isRecording()) return false;
			try {
				await api.stopRecording();
			} catch {
				// System Recording reports its own errors
			}
			return true;
		},
	};
}

/**
 * Picks the recorder for the setting. System Recording is used through its
 * API when available, through its commands on versions without the API, and
 * the core recorder is used (`fellBack`) when System Recording is not enabled.
 */
export function resolveRecorder(
	app: unknown,
	choice: RecorderChoice
): { recorder: Recorder; fellBack: boolean } {
	if (choice === "system-recording") {
		const api = getSystemRecordingApi(app);
		if (api) return { recorder: apiRecorder(api), fellBack: false };
		if (isSystemRecordingEnabled(app)) {
			return {
				recorder: commandRecorder(app, "system-recording-command", SYSTEM_RECORDING_START, SYSTEM_RECORDING_STOP),
				fellBack: false,
			};
		}
		return { recorder: commandRecorder(app, "core", CORE_START, CORE_STOP), fellBack: true };
	}
	return { recorder: commandRecorder(app, "core", CORE_START, CORE_STOP), fellBack: false };
}
