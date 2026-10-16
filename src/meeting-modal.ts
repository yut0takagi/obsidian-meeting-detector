import { App, Modal, Setting } from "obsidian";
import type { MeetingApp } from "./process-monitor";
import type MeetingDetectorPlugin from "./main";

export class MeetingDetectedModal extends Modal {
	private plugin: MeetingDetectorPlugin;
	private meetingApp: MeetingApp;
	private title: string;

	constructor(app: App, plugin: MeetingDetectorPlugin, meetingApp: MeetingApp) {
		super(app);
		this.plugin = plugin;
		this.meetingApp = meetingApp;
		this.title = `${meetingApp} meeting`;
	}

	onOpen(): void {
		const { contentEl } = this;

		contentEl.addClass("meeting-detector-modal");

		contentEl.createEl("h2", { text: "Meeting detected" });
		contentEl.createEl("p", {
			text: `${this.meetingApp} is running. What would you like to do?`,
			cls: "meeting-detector-description",
		});

		new Setting(contentEl)
			.setName("Title")
			.setDesc("Used for the note and the recording file names.")
			.addText((text) => {
				text.setValue(this.title).onChange((value) => {
					this.title = value;
				});
				text.inputEl.addClass("meeting-detector-title");
				// Select the default so typing replaces it.
				text.inputEl.select();
			});

		const buttonContainer = contentEl.createDiv({
			cls: "meeting-detector-buttons",
		});

		// Record button
		const recordBtn = buttonContainer.createEl("button", {
			text: "Start recording",
			cls: "meeting-detector-btn meeting-detector-btn-record",
		});
		recordBtn.addEventListener("click", () => {
			this.close();
			void this.plugin.startRecording({ title: this.title });
		});

		// Create note button
		const noteBtn = buttonContainer.createEl("button", {
			text: "Create meeting note",
			cls: "meeting-detector-btn meeting-detector-btn-note",
		});
		noteBtn.addEventListener("click", () => {
			this.close();
			void this.plugin.createMeetingNote(this.meetingApp, this.title);
		});

		// Both button: the note first, so the recording is linked into it
		const bothBtn = buttonContainer.createEl("button", {
			text: "Record & create note",
			cls: "meeting-detector-btn meeting-detector-btn-both",
		});
		bothBtn.addEventListener("click", () => {
			this.close();
			void this.recordAndCreateNote();
		});

		// Dismiss button
		const dismissBtn = buttonContainer.createEl("button", {
			text: "Dismiss",
			cls: "meeting-detector-btn meeting-detector-btn-dismiss",
		});
		dismissBtn.addEventListener("click", () => {
			this.plugin.monitor.dismiss(this.meetingApp);
			this.close();
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}

	private async recordAndCreateNote(): Promise<void> {
		const file = await this.plugin.createMeetingNote(this.meetingApp, this.title);
		await this.plugin.startRecording({ title: this.title, notePath: file?.path });
	}
}
