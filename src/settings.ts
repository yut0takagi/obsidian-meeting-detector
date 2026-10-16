import { App, PluginSettingTab, Setting } from "obsidian";
import type MeetingDetectorPlugin from "./main";
import { isSystemRecordingEnabled, type RecorderChoice } from "./recorder-backend";

export type EndAction = "stop-recording" | "notice" | "none";

export interface MeetingDetectorSettings {
	enableZoom: boolean;
	enableGoogleMeet: boolean;
	enableTeams: boolean;
	pollingIntervalSeconds: number;
	templateFilePath: string;
	notesFolderPath: string;
	noteFileNameFormat: string;
	endAction: EndAction;
	pluginEnabled: boolean;
	/** Do not announce apps that were already running when Obsidian started (e.g. Zoom kept open all day). */
	ignoreRunningAtStartup: boolean;
	/** Also show a system notification when Obsidian is in the background. */
	desktopNotification: boolean;
	recorder: RecorderChoice;
}

export const DEFAULT_SETTINGS: MeetingDetectorSettings = {
	enableZoom: true,
	enableGoogleMeet: true,
	enableTeams: true,
	pollingIntervalSeconds: 5,
	templateFilePath: "",
	notesFolderPath: "Meetings",
	noteFileNameFormat: "YYYY-MM-DD_{{title}}",
	endAction: "notice",
	pluginEnabled: true,
	ignoreRunningAtStartup: false,
	desktopNotification: true,
	recorder: "core",
};

export class MeetingDetectorSettingTab extends PluginSettingTab {
	plugin: MeetingDetectorPlugin;

	constructor(app: App, plugin: MeetingDetectorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// --- Plugin enabled ---
		new Setting(containerEl)
			.setName("Enable plugin")
			.setDesc("Toggle meeting detection on or off.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.pluginEnabled)
					.onChange(async (value) => {
						this.plugin.settings.pluginEnabled = value;
						await this.plugin.saveSettings();
						if (value) {
							this.plugin.startMonitoring();
						} else {
							this.plugin.stopMonitoring();
						}
					})
			);

		// --- Monitoring targets ---
		new Setting(containerEl).setName("Monitoring").setHeading();

		new Setting(containerEl)
			.setName("Zoom")
			.setDesc("Detect running meetings.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableZoom)
					.onChange(async (value) => {
						this.plugin.settings.enableZoom = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Google meet")
			.setDesc("Detect running sessions via browser tab title.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableGoogleMeet)
					.onChange(async (value) => {
						this.plugin.settings.enableGoogleMeet = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Microsoft teams")
			.setDesc("Detect running meetings.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableTeams)
					.onChange(async (value) => {
						this.plugin.settings.enableTeams = value;
						await this.plugin.saveSettings();
					})
			);

		// --- Polling interval ---
		new Setting(containerEl)
			.setName("Polling interval (seconds)")
			.setDesc("How often to check for running meeting apps.")
			.addText((text) =>
				text
					.setPlaceholder("5")
					.setValue(String(this.plugin.settings.pollingIntervalSeconds))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num >= 1) {
							this.plugin.settings.pollingIntervalSeconds = num;
							await this.plugin.saveSettings();
							this.plugin.restartMonitoring();
						}
					})
			);

		new Setting(containerEl)
			.setName("Ignore apps already running at startup")
			.setDesc(
				"Useful if you keep a meeting app open all day. Apps that are running when Obsidian starts are not announced until they quit and start again."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.ignoreRunningAtStartup)
					.onChange(async (value) => {
						this.plugin.settings.ignoreRunningAtStartup = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Desktop notification")
			.setDesc("Also show a system notification when Obsidian is in the background.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.desktopNotification)
					.onChange(async (value) => {
						this.plugin.settings.desktopNotification = value;
						await this.plugin.saveSettings();
					})
			);

		// --- Recording ---
		new Setting(containerEl).setName("Recording").setHeading();

		const systemRecordingEnabled = isSystemRecordingEnabled(this.app);
		new Setting(containerEl)
			.setName("Record with")
			.setDesc(
				systemRecordingEnabled
					? "The core audio recorder records only your microphone. The system recording plugin also records the other participants (system audio), even with headphones."
					: "The core audio recorder records only your microphone. To also record the other participants (system audio), install and enable the system recording plugin."
			)
			.addDropdown((dropdown) => {
				dropdown.addOption("core", "Core audio recorder");
				if (systemRecordingEnabled) {
					dropdown.addOption("system-recording", "System recording plugin");
				}
				dropdown
					.setValue(
						systemRecordingEnabled ? this.plugin.settings.recorder : "core"
					)
					.onChange(async (value) => {
						this.plugin.settings.recorder =
							value === "system-recording" ? "system-recording" : "core";
						await this.plugin.saveSettings();
					});
			});

		// --- Meeting notes ---
		new Setting(containerEl).setName("Notes").setHeading();

		new Setting(containerEl)
			.setName("Template file path")
			.setDesc(
				"Path to a template file in your vault. Leave empty for the default template."
			)
			.addText((text) =>
				text
					.setPlaceholder("Templates/Meeting.md")
					.setValue(this.plugin.settings.templateFilePath)
					.onChange(async (value) => {
						this.plugin.settings.templateFilePath = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Notes folder")
			.setDesc("Folder where meeting notes are saved.")
			.addText((text) =>
				text
					.setPlaceholder("Meetings")
					.setValue(this.plugin.settings.notesFolderPath)
					.onChange(async (value) => {
						this.plugin.settings.notesFolderPath = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("File name format")
			.setDesc(
				"For example `YYYY-MM-DD_{{title}}`. Date tokens: YYYY MM DD HH mm ss (also YY MMM MMMM Do ddd dddd hh). {{title}} is the title from the popup. Text in [brackets] is kept as is."
			)
			.addText((text) =>
				text
					.setPlaceholder("YYYY-MM-DD_{{title}}")
					.setValue(this.plugin.settings.noteFileNameFormat)
					.onChange(async (value) => {
						this.plugin.settings.noteFileNameFormat = value;
						await this.plugin.saveSettings();
					})
			);

		// --- End action ---
		new Setting(containerEl).setName("End behavior").setHeading();

		new Setting(containerEl)
			.setName("Action on meeting end")
			.setDesc("What to do when a meeting app closes.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("stop-recording", "Stop recording")
					.addOption("notice", "Show notification")
					.addOption("none", "Do nothing")
					.setValue(this.plugin.settings.endAction)
					.onChange(async (value) => {
						this.plugin.settings.endAction = value as EndAction;
						await this.plugin.saveSettings();
					})
			);
	}
}
