/**
 * File name templates (same rules as the System Recording plugin).
 *
 * A run of ASCII letters is formatted as a date only when the whole run is made
 * of the tokens below (so `HHmmss` is a time but `summary` stays a word).
 * `[text]` is always literal, as in moment. `{{title}}` is replaced with the
 * sanitized title and is never interpreted as date tokens.
 */

/** Longest first, so `MMMM` wins over `MM` and `dddd` over `ddd`. */
const DATE_TOKENS = ["YYYY", "MMMM", "dddd", "MMM", "ddd", "YY", "MM", "DD", "Do", "HH", "hh", "mm", "ss"];

const TITLE = "{{title}}";
const SEPARATORS = "-_ .";
/** Leaves room for a " 99" counter and an extension within the 255-byte APFS limit. */
const MAX_NAME_BYTES = 180;

export interface FormatFileNameOptions {
	/** Formats a run of date tokens, e.g. `(f) => moment().format(f)`. */
	format: (tokens: string) => string;
	title?: string | null;
	/** Used when the result would otherwise be empty. */
	fallback?: string;
}

export function formatFileName(template: string, options: FormatFileNameOptions): string {
	const title = sanitizeFileName(options.title ?? "");
	let out = "";
	let dropNextSeparator = false;
	const append = (text: string) => {
		if (dropNextSeparator && text.length > 0) {
			if (SEPARATORS.includes(text.charAt(0))) text = text.slice(1);
			dropNextSeparator = false;
		}
		out += text;
	};

	let i = 0;
	while (i < template.length) {
		if (template.startsWith(TITLE, i)) {
			if (title) {
				append(title);
			} else if (out.length > 0 && SEPARATORS.includes(out.charAt(out.length - 1))) {
				out = out.slice(0, -1);
			} else {
				dropNextSeparator = true;
			}
			i += TITLE.length;
			continue;
		}
		const ch = template.charAt(i);
		if (ch === "[") {
			const close = template.indexOf("]", i + 1);
			if (close !== -1) {
				append(template.slice(i + 1, close));
				i = close + 1;
				continue;
			}
		}
		if (isAsciiLetter(ch)) {
			let j = i;
			while (j < template.length && isAsciiLetter(template.charAt(j))) j++;
			const run = template.slice(i, j);
			append(isDateRun(run) ? options.format(run) : run);
			i = j;
			continue;
		}
		append(ch);
		i++;
	}

	const name = truncateUtf8(sanitizeFileName(out), MAX_NAME_BYTES).replace(/[\s.]+$/, "");
	return name || sanitizeFileName(options.fallback ?? "") || "untitled";
}

/**
 * Makes a string safe as a file name and inside a wikilink: `/` and `\` become
 * `-`; characters Obsidian rejects or that break links are removed.
 */
export function sanitizeFileName(input: string): string {
	return Array.from(input, (c) => {
		const code = c.charCodeAt(0);
		if (code >= 0x20 && code !== 0x7f) return c;
		return c === "\n" || c === "\t" || c === "\r" ? " " : "";
	})
		.join("")
		.replace(/[\\/]/g, "-")
		.replace(/[:*?"<>|#^[\]]/g, "")
		.replace(/\s+/g, " ")
		.trim()
		.replace(/^\.+/, "")
		.replace(/[\s.]+$/, "")
		.trim();
}

/** Returns `base`, or `base 1`, `base 2`, … — the first that `taken` reports free. */
export function uniqueBaseName(base: string, taken: (candidate: string) => boolean): string {
	if (!taken(base)) return base;
	for (let n = 1; n < 1000; n++) {
		const candidate = `${base} ${n}`;
		if (!taken(candidate)) return candidate;
	}
	return `${base} ${Date.now()}`;
}

/** Like uniqueBaseName, for lookups that are async (e.g. the vault adapter, which matches the file system's case rules). */
export async function uniqueBaseNameAsync(
	base: string,
	taken: (candidate: string) => Promise<boolean>
): Promise<string> {
	if (!(await taken(base))) return base;
	for (let n = 1; n < 1000; n++) {
		const candidate = `${base} ${n}`;
		if (!(await taken(candidate))) return candidate;
	}
	return `${base} ${Date.now()}`;
}

function isAsciiLetter(ch: string): boolean {
	return /^[A-Za-z]$/.test(ch);
}

function isDateRun(run: string): boolean {
	let i = 0;
	while (i < run.length) {
		const token = DATE_TOKENS.find((t) => run.startsWith(t, i));
		if (!token) return false;
		i += token.length;
	}
	return true;
}

function truncateUtf8(input: string, maxBytes: number): string {
	const encoder = new TextEncoder();
	if (encoder.encode(input).length <= maxBytes) return input;
	let out = "";
	let bytes = 0;
	for (const ch of input) {
		const size = encoder.encode(ch).length;
		if (bytes + size > maxBytes) break;
		out += ch;
		bytes += size;
	}
	return out;
}
