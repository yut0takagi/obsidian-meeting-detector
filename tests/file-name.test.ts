import { describe, it, expect } from "vitest";
import { formatFileName, sanitizeFileName, uniqueBaseName, uniqueBaseNameAsync } from "../src/file-name";

// Stands in for moment().format() at 2026-10-16 09:05 (moment cannot be imported in tests).
const VALUES: Record<string, string> = { YYYY: "2026", MM: "10", DD: "16", HH: "09", mm: "05" };
const format = (fmt: string) => fmt.replace(/YYYY|MM|DD|HH|mm/g, (t) => VALUES[t] ?? t);

describe("formatFileName", () => {
	it("formats the new default with the title", () => {
		expect(formatFileName("YYYY-MM-DD_{{title}}", { format, title: "Zoom meeting" })).toBe(
			"2026-10-16_Zoom meeting"
		);
	});

	it("keeps the word in the old default instead of reading its letters as tokens", () => {
		// moment().format("YYYY-MM-DD_HHmm_Meeting") gives "..._1055ting"
		expect(formatFileName("YYYY-MM-DD_HHmm_Meeting", { format })).toBe("2026-10-16_0905_Meeting");
	});

	it("keeps [bracketed] text literal, like moment", () => {
		expect(formatFileName("[Notes] YYYY", { format })).toBe("Notes 2026");
	});

	it("never interprets the title as date tokens", () => {
		expect(formatFileName("{{title}}", { format, title: "MM DD summary" })).toBe("MM DD summary");
	});

	it("removes characters that are not allowed in file names or links", () => {
		expect(formatFileName("{{title}}", { format, title: 'Q3: plan/review #2 [draft]?' })).toBe(
			"Q3 plan-review 2 draft"
		);
	});

	it("drops the separator next to an empty title and falls back when nothing is left", () => {
		expect(formatFileName("YYYY-MM-DD_{{title}}", { format, title: " " })).toBe("2026-10-16");
		expect(formatFileName("{{title}}", { format, fallback: "Meeting" })).toBe("Meeting");
	});

	it("caps the length in UTF-8 bytes", () => {
		const out = formatFileName("{{title}}", { format, title: "会".repeat(300) });
		expect(new TextEncoder().encode(out).length).toBeLessThanOrEqual(180);
	});
});

describe("sanitizeFileName", () => {
	it("removes leading dots and control characters", () => {
		expect(sanitizeFileName("..a\u0000b\nc")).toBe("ab c");
	});
});

describe("uniqueBaseName", () => {
	it("appends a counter while the name is taken", () => {
		const taken = new Set(["2026-10-16_Sync", "2026-10-16_Sync 1"]);
		expect(uniqueBaseName("2026-10-16_Sync", (n) => taken.has(n))).toBe("2026-10-16_Sync 2");
		expect(uniqueBaseName("free", () => false)).toBe("free");
	});
});

describe("uniqueBaseNameAsync", () => {
	it("checks candidates with an async lookup (e.g. the vault adapter)", async () => {
		const taken = new Set(["Sync", "Sync 1"]);
		await expect(uniqueBaseNameAsync("Sync", async (n) => taken.has(n))).resolves.toBe("Sync 2");
	});
});
