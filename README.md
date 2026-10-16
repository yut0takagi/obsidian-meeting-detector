# Meeting Detector - Obsidian Plugin

![Downloads](https://raw.githubusercontent.com/yut0takagi/obsidian-meeting-detector/main/.github/stats/badge.svg)

![Download history](https://raw.githubusercontent.com/yut0takagi/obsidian-meeting-detector/main/.github/stats/downloads.svg)

Automatically detect online meetings (Zoom, Google Meet, Microsoft Teams) and prompt you to start recording or create meeting notes.

![Demo](https://img.shields.io/badge/platform-macOS-blue)

## Features

- **Auto-detect meetings** — Monitors for Zoom, Google Meet, and Microsoft Teams in the background
- **One-click actions** — Start recording, create a meeting note, or both from a single popup
- **Meeting notes from templates** — Generate notes with `{{date}}`, `{{time}}`, `{{app}}` variables
- **Meeting end detection** — Optionally auto-stop recording or show a notification when a meeting ends
- **Configurable** — Polling interval, target apps, note templates, file naming, and more

## How It Works

The plugin periodically checks for running meeting applications:

| App | Detection Method |
|-----|-----------------|
| **Zoom** | Process detection (`pgrep`) |
| **Microsoft Teams** | Process detection (`pgrep`) |
| **Google Meet** | Browser tab title detection via `osascript` (Chrome, Brave, Edge, Arc, Safari) |

When a meeting is detected, a modal appears with options to:
- **Start Recording** — Triggers the built-in Audio Recorder core plugin
- **Create Meeting Note** — Creates a note from your template
- **Record & Create Note** — Both actions at once
- **Dismiss** — Close the modal (won't show again for this session)

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Enable plugin | Toggle monitoring on/off | On |
| Zoom / Google Meet / Teams | Enable/disable each app | All on |
| Polling interval | How often to check (seconds) | 5 |
| Template file path | Path to a template in your vault | (built-in default) |
| Notes folder | Where meeting notes are saved | `Meetings` |
| File name format | Moment.js format string | `YYYY-MM-DD_HHmm_Meeting` |
| Action on meeting end | Stop recording / Show notice / Do nothing | Show notice |

## Template Variables

Use these in your template file:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{date}}` | Current date | 2026-04-06 |
| `{{time}}` | Current time | 14:30 |
| `{{app}}` | Detected app name | Zoom |

## Requirements

- **macOS** (uses `pgrep` and `osascript` for detection)
- **Obsidian v1.0.0+**
- Audio Recorder core plugin (optional, for recording functionality)

## Installation

### From Community Plugins

1. Open Obsidian Settings
2. Go to **Community Plugins** and disable Safe Mode
3. Click **Browse** and search for "Meeting Detector"
4. Click **Install**, then **Enable**

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/yut0takagi/obsidian-meeting-detector/releases)
2. Create a folder `meeting-detector` in your vault's `.obsidian/plugins/` directory
3. Copy the downloaded files into that folder
4. Restart Obsidian and enable the plugin in Settings > Community Plugins

## Development

```bash
git clone https://github.com/yut0takagi/obsidian-meeting-detector.git
cd obsidian-meeting-detector
npm install
npm run dev
```

## License

[MIT](LICENSE)
