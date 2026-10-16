import { App, TFile, moment, normalizePath } from "obsidian";
import type { MeetingDetectorSettings } from "./settings";
import type { MeetingApp } from "./process-monitor";
import { formatFileName, uniqueBaseNameAsync } from "./file-name";
import { DEFAULT_TEMPLATE, fillTemplate, notePath } from "./note-template";

export class NoteGenerator {
	private app: App;
	private getSettings: () => MeetingDetectorSettings;

	constructor(app: App, getSettings: () => MeetingDetectorSettings) {
		this.app = app;
		this.getSettings = getSettings;
	}

	async create(meetingApp: MeetingApp, title: string): Promise<TFile> {
		const settings = this.getSettings();
		const now = moment();
		const noteTitle = title.trim() || `${meetingApp} meeting`;

		const baseName = formatFileName(settings.noteFileNameFormat, {
			format: (tokens) => now.format(tokens),
			title: noteTitle,
			fallback: "Meeting",
		});
		const folderPath = normalizePath(settings.notesFolderPath.trim() || "Meetings");
		await this.ensureFolder(folderPath);

		// The adapter follows the file system's case rules, so "sync.md" and "Sync.md" collide as they would on disk.
		const adapter = this.app.vault.adapter;
		const fileName = await uniqueBaseNameAsync(baseName, (candidate) =>
			adapter.exists(notePath(folderPath, candidate))
		);

		const content = fillTemplate(await this.getTemplateContent(), {
			date: now.format("YYYY-MM-DD"),
			time: now.format("HH:mm"),
			app: meetingApp,
			title: noteTitle,
		});

		return await this.app.vault.create(notePath(folderPath, fileName), content);
	}

	private async getTemplateContent(): Promise<string> {
		const settings = this.getSettings();
		if (!settings.templateFilePath) {
			return DEFAULT_TEMPLATE;
		}

		const templateFile = this.app.vault.getAbstractFileByPath(
			settings.templateFilePath
		);
		if (templateFile instanceof TFile) {
			return await this.app.vault.read(templateFile);
		}

		return DEFAULT_TEMPLATE;
	}

	private async ensureFolder(folderPath: string): Promise<void> {
		if (folderPath === "/") return;
		const parts = folderPath.split("/");
		let current = "";
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			if (!this.app.vault.getAbstractFileByPath(current)) {
				await this.app.vault.createFolder(current);
			}
		}
	}
}
