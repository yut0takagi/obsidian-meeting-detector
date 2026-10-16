import { Notice, Plugin } from "obsidian";
import {
	DEFAULT_SETTINGS,
	MeetingDetectorSettingTab,
	type MeetingDetectorSettings,
} from "./settings";
import { ProcessMonitor, type MeetingEvent } from "./process-monitor";
import { MeetingDetectedModal } from "./meeting-modal";
import { NoteGenerator } from "./note-generator";

export default class MeetingDetectorPlugin extends Plugin {
	settings: MeetingDetectorSettings;
	monitor: ProcessMonitor;
	noteGenerator: NoteGenerator;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.noteGenerator = new NoteGenerator(
			this.app,
			() => this.settings
		);

		this.monitor = new ProcessMonitor(
			() => this.settings,
			(event) => this.onMeetingEvent(event)
		);

		this.addSettingTab(new MeetingDetectorSettingTab(this.app, this));

		this.addCommand({
			id: "check-meetings-now",
			name: "Check for meetings now",
			callback: () => {
				new Notice("Checking for meetings...");
				void this.monitor.checkNow();
			},
		});

		if (this.settings.pluginEnabled) {
			this.startMonitoring();
		}
	}

	onunload(): void {
		this.stopMonitoring();
	}

	startMonitoring(): void {
		this.monitor.start();
	}

	stopMonitoring(): void {
		this.monitor.stop();
	}

	restartMonitoring(): void {
		this.monitor.restart();
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<MeetingDetectorSettings>
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private onMeetingEvent(event: MeetingEvent): void {
		if (event.type === "start") {
			new MeetingDetectedModal(this.app, this, event.app).open();
		} else if (event.type === "end") {
			this.handleMeetingEnd(event);
		}
	}

	private handleMeetingEnd(event: MeetingEvent): void {
		const commands = (this.app as unknown as Record<string, unknown>)
			.commands as
			| { executeCommandById: (id: string) => boolean }
			| undefined;

		switch (this.settings.endAction) {
			case "stop-recording":
				if (commands) {
					commands.executeCommandById("audio-recorder:stop");
				}
				new Notice(`${event.app} ended. Recording stopped.`);
				break;
			case "notice":
				new Notice(`${event.app} meeting ended.`);
				break;
			case "none":
				break;
		}
	}
}
