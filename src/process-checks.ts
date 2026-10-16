/**
 * One-shot checks for meeting apps. Each check answers "running",
 * "not-running" or "unknown" (the check itself failed or timed out), so a
 * flaky check never looks like the meeting ended.
 */

export type ProcessState = "running" | "not-running" | "unknown";

/** The subset of child_process.execFile used here (injected for tests). */
export type ExecFileFn = (
	file: string,
	args: string[],
	options: { timeout?: number },
	callback: (
		error: (Error & { code?: number | string; killed?: boolean }) | null,
		stdout: string,
		stderr: string
	) => void
) => void;

export const ZOOM_PROCESS_NAMES = ["zoom.us"];
/** New Teams (com.microsoft.teams2) runs as MSTeams; classic Teams runs as Teams. */
export const TEAMS_PROCESS_NAMES = ["MSTeams", "Teams"];

const PGREP_TIMEOUT_MS = 3000;
const OSASCRIPT_TIMEOUT_MS = 5000;

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

/** `pgrep -x <name>`: exit 0 = found, exit 1 = not found, anything else = unknown. */
export function checkProcess(exec: ExecFileFn, processName: string): Promise<ProcessState> {
	return new Promise((resolve) => {
		exec("pgrep", ["-x", processName], { timeout: PGREP_TIMEOUT_MS }, (error) => {
			if (!error) resolve("running");
			else if (error.code === 1 && !error.killed) resolve("not-running");
			else resolve("unknown");
		});
	});
}

/** Running if any name is running; not running only if every check says so. */
export async function checkAnyProcess(exec: ExecFileFn, processNames: string[]): Promise<ProcessState> {
	const states = await Promise.all(processNames.map((name) => checkProcess(exec, name)));
	if (states.includes("running")) return "running";
	if (states.includes("unknown")) return "unknown";
	return "not-running";
}

/** Looks for a meet.google.com tab in the supported browsers via osascript. */
export function checkGoogleMeet(exec: ExecFileFn): Promise<ProcessState> {
	return new Promise((resolve) => {
		exec(
			"osascript",
			["-e", OSASCRIPT_GET_BROWSER_TABS],
			{ timeout: OSASCRIPT_TIMEOUT_MS },
			(error, stdout) => {
				if (error) {
					resolve("unknown");
					return;
				}
				const answer = String(stdout).trim();
				if (answer === "true") resolve("running");
				else if (answer === "false") resolve("not-running");
				else resolve("unknown");
			}
		);
	});
}
