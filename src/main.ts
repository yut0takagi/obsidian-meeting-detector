/* global activeWindow, activeDocument -- Obsidian exposes these on the active (possibly popped-out) window */
import { Notice, Plugin, TFile } from "obsidian";
import {
	DEFAULT_SETTINGS,
	MeetingDetectorSettingTab,
	type MeetingDetectorSettings,
} from "./settings";
import { ProcessMonitor, type MeetingApp, type MeetingEvent } from "./process-monitor";
import { MeetingDetectedModal } from "./meeting-modal";
import { NoteGenerator } from "./note-generator";
import { resolveRecorder, type RecordingRequest } from "./recorder-backend";
import {
	NotificationCtor,
	shouldNotifyDesktop,
	showDesktopNotification,
} from "./desktop-notification";

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

	/** Starts recording with the recorder chosen in the settings. */
	async startRecording(request: RecordingRequest): Promise<void> {
		const { recorder, fellBack } = resolveRecorder(this.app, this.settings.recorder);
		if (fellBack) {
			new Notice(
				"The system recording plugin is not enabled, so the core audio recorder is used (your microphone only)."
			);
		}
		const started = await recorder.start(request);
		if (recorder.kind !== "core") return; // System Recording shows its own notices
		new Notice(
			started
				? "Recording started."
				: "Audio recorder is not available. Please enable the core audio recorder plugin."
		);
	}

	/** Creates and opens the meeting note. Returns null (after a notice) when it fails. */
	async createMeetingNote(meetingApp: MeetingApp, title: string): Promise<TFile | null> {
		try {
			const file = await this.noteGenerator.create(meetingApp, title);
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file);
			new Notice(`Meeting note created: ${file.path}`);
			return file;
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			new Notice(`Failed to create meeting note: ${message}`);
			return null;
		}
	}

	private onMeetingEvent(event: MeetingEvent): void {
		if (event.type === "start") {
			new MeetingDetectedModal(this.app, this, event.app).open();
			this.notifyInBackground(event.app);
		} else if (event.type === "end") {
			void this.handleMeetingEnd(event);
		}
	}

	/** The popup is easy to miss behind other windows, so also show a system notification. */
	private notifyInBackground(app: MeetingApp): void {
		if (!shouldNotifyDesktop(this.settings.desktopNotification, activeDocument.hasFocus())) return;
		const ctor = (activeWindow as unknown as { Notification?: NotificationCtor }).Notification;
		showDesktopNotification(
			ctor,
			"Meeting detected",
			`${app} is running. Open Obsidian to record or create a meeting note.`,
			() => activeWindow.focus()
		);
	}

	private async handleMeetingEnd(event: MeetingEvent): Promise<void> {
		switch (this.settings.endAction) {
			case "stop-recording": {
				const { recorder } = resolveRecorder(this.app, this.settings.recorder);
				const stopped = await recorder.stop();
				new Notice(
					stopped
						? `${event.app} ended. Recording stopped.`
						: `${event.app} meeting ended.`
				);
				break;
			}
			case "notice":
				new Notice(`${event.app} meeting ended.`);
				break;
			case "none":
				break;
		}
	}
}
