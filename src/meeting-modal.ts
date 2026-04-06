import { App, Modal, Notice } from "obsidian";
import type { MeetingApp } from "./process-monitor";
import type MeetingDetectorPlugin from "./main";

export class MeetingDetectedModal extends Modal {
	private plugin: MeetingDetectorPlugin;
	private meetingApp: MeetingApp;

	constructor(app: App, plugin: MeetingDetectorPlugin, meetingApp: MeetingApp) {
		super(app);
		this.plugin = plugin;
		this.meetingApp = meetingApp;
	}

	onOpen(): void {
		const { contentEl } = this;

		contentEl.addClass("meeting-detector-modal");

		contentEl.createEl("h2", { text: "Meeting detected" });
		contentEl.createEl("p", {
			text: `${this.meetingApp} is running. What would you like to do?`,
			cls: "meeting-detector-description",
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
			this.startRecording();
			this.close();
		});

		// Create note button
		const noteBtn = buttonContainer.createEl("button", {
			text: "Create meeting note",
			cls: "meeting-detector-btn meeting-detector-btn-note",
		});
		noteBtn.addEventListener("click", () => {
			void this.createMeetingNote();
			this.close();
		});

		// Both button
		const bothBtn = buttonContainer.createEl("button", {
			text: "Record & create note",
			cls: "meeting-detector-btn meeting-detector-btn-both",
		});
		bothBtn.addEventListener("click", () => {
			this.startRecording();
			void this.createMeetingNote();
			this.close();
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

	private startRecording(): void {
		// executeCommandById is not in the public API typings but is stable
		const commands = (this.app as unknown as Record<string, unknown>)
			.commands as
			| { executeCommandById: (id: string) => boolean }
			| undefined;
		if (commands) {
			const result = commands.executeCommandById("audio-recorder:start");
			if (result === false) {
				new Notice(
					"Audio recorder is not available. Please enable the core audio recorder plugin."
				);
				return;
			}
		}
		new Notice("Recording started.");
	}

	private async createMeetingNote(): Promise<void> {
		try {
			const file = await this.plugin.noteGenerator.create(this.meetingApp);
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file);
			new Notice(`Meeting note created: ${file.path}`);
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			new Notice(`Failed to create meeting note: ${message}`);
		}
	}
}
