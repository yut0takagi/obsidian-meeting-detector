import { describe, it, expect } from "vitest";
import { DEFAULT_TEMPLATE, fillTemplate, notePath } from "../src/note-template";

const VARS = { date: "2026-10-16", time: "09:05", app: "Zoom", title: "Design review" };

describe("fillTemplate", () => {
	it("replaces every variable, including {{title}}", () => {
		expect(fillTemplate("{{title}} | {{date}} {{time}} | {{app}} | {{title}}", VARS)).toBe(
			"Design review | 2026-10-16 09:05 | Zoom | Design review"
		);
	});

	it("does not expand variables that come from the title itself", () => {
		expect(fillTemplate("# {{title}}", { ...VARS, title: "{{date}}" })).toBe("# {{date}}");
	});

	it("leaves unknown placeholders alone", () => {
		expect(fillTemplate("{{attendees}}", VARS)).toBe("{{attendees}}");
	});

	it("uses the title as the heading of the default template", () => {
		expect(fillTemplate(DEFAULT_TEMPLATE, VARS).split("\n")[0]).toBe("# Design review");
	});
});

describe("notePath", () => {
	it("joins the folder and the name", () => {
		expect(notePath("Meetings", "2026-10-16_Sync")).toBe("Meetings/2026-10-16_Sync.md");
	});

	it("uses the vault root for an empty folder or /", () => {
		expect(notePath("", "a")).toBe("a.md");
		expect(notePath("/", "a")).toBe("a.md");
		expect(notePath("Meetings/", "a")).toBe("Meetings/a.md");
	});
});
