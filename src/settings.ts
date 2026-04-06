import { App, PluginSettingTab, Setting } from "obsidian";
import type MeetingDetectorPlugin from "./main";

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
}

export const DEFAULT_SETTINGS: MeetingDetectorSettings = {
	enableZoom: true,
	enableGoogleMeet: true,
	enableTeams: true,
	pollingIntervalSeconds: 5,
	templateFilePath: "",
	notesFolderPath: "Meetings",
	noteFileNameFormat: "YYYY-MM-DD_HHmm_Meeting",
	endAction: "notice",
	pluginEnabled: true,
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

		/* eslint-disable obsidianmd/ui/sentence-case -- product names */
		new Setting(containerEl)
			.setName("Zoom")
			.setDesc("Detect Zoom meetings.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableZoom)
					.onChange(async (value) => {
						this.plugin.settings.enableZoom = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Google Meet")
			.setDesc("Detect Google Meet sessions via browser tab title.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableGoogleMeet)
					.onChange(async (value) => {
						this.plugin.settings.enableGoogleMeet = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Microsoft Teams")
			.setDesc("Detect Microsoft Teams meetings.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableTeams)
					.onChange(async (value) => {
						this.plugin.settings.enableTeams = value;
						await this.plugin.saveSettings();
					})
			);
		/* eslint-enable obsidianmd/ui/sentence-case */

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

		/* eslint-disable obsidianmd/ui/sentence-case -- format example */
		new Setting(containerEl)
			.setName("File name format")
			.setDesc(
				"Format string for the note file name (e.g., YYYY-MM-DD_HHmm_Meeting)."
			)
			.addText((text) =>
				text
					.setPlaceholder("YYYY-MM-DD_HHmm_Meeting")
					.setValue(this.plugin.settings.noteFileNameFormat)
					.onChange(async (value) => {
						this.plugin.settings.noteFileNameFormat = value;
						await this.plugin.saveSettings();
					})
			);
		/* eslint-enable obsidianmd/ui/sentence-case */

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
