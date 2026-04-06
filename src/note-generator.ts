import { App, TFile, moment } from "obsidian";
import type { MeetingDetectorSettings } from "./settings";
import type { MeetingApp } from "./process-monitor";

const DEFAULT_TEMPLATE = `# Meeting Note

- **Date**: {{date}}
- **Time**: {{time}}
- **App**: {{app}}

## Attendees

-

## Agenda

-

## Notes



## Action Items

- [ ]
`;

export class NoteGenerator {
	private app: App;
	private getSettings: () => MeetingDetectorSettings;

	constructor(app: App, getSettings: () => MeetingDetectorSettings) {
		this.app = app;
		this.getSettings = getSettings;
	}

	async create(meetingApp: MeetingApp): Promise<TFile> {
		const settings = this.getSettings();
		const now = moment();

		const fileName = now.format(settings.noteFileNameFormat) + ".md";
		const folderPath = settings.notesFolderPath || "Meetings";
		const filePath = `${folderPath}/${fileName}`;

		await this.ensureFolder(folderPath);

		let content = await this.getTemplateContent();
		content = this.replaceVariables(content, now, meetingApp);

		const file = await this.app.vault.create(filePath, content);
		return file;
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

	private replaceVariables(
		content: string,
		now: moment.Moment,
		meetingApp: MeetingApp
	): string {
		return content
			.replace(/\{\{date\}\}/g, now.format("YYYY-MM-DD"))
			.replace(/\{\{time\}\}/g, now.format("HH:mm"))
			.replace(/\{\{app\}\}/g, meetingApp);
	}

	private async ensureFolder(folderPath: string): Promise<void> {
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
