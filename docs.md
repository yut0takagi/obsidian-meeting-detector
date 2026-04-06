# Meeting Detector - Obsidian Community Plugin 要件定義

## 概要

オンラインミーティング（Zoom / Google Meet / Microsoft Teams）の開始を自動検知し、Obsidian内にポップアップを表示するコミュニティプラグイン。ユーザーはポップアップから録音開始やミーティングノート作成をワンクリックで実行できる。

## 背景・課題

- ミーティング開始時に手動でObsidianを開いて録音やノート作成を行うのは手間がかかる
- 録音やノート作成を忘れるケースが多い
- 既存のObsidianプラグインにはミーティング検知 → ポップアップ通知の機能を持つものが存在しない

## 対象ユーザー

- Obsidianでミーティングノートを管理しているユーザー
- ミーティングの録音・文字起こしをObsidian上で行いたいユーザー

## 対応プラットフォーム

- macOS（優先）
- Windows（将来対応）
- Linux（将来対応）

---

## 機能要件

### F-01: ミーティングアプリ検知

- バックグラウンドで定期的にプロセスを監視し、対象アプリの起動を検知する
- 監視間隔は設定画面から変更可能（デフォルト: 5秒）
- 対応アプリ:
  - **Zoom**: プロセス名による検知
  - **Microsoft Teams**: プロセス名による検知
  - **Google Meet**: ブラウザタブのタイトルに "Meet" が含まれるかを `osascript`（macOS）で取得して検知

### F-02: ポップアップ（Modal）表示

- ミーティング検知時にObsidian内にModalを表示する
- Modal内に以下のアクションボタンを配置:
  - **録音開始**: Obsidianコアプラグイン「Audio Recorder」の録音を開始する
  - **ミーティングノート作成**: テンプレートからノートを新規作成する
  - **無視**: Modalを閉じて何もしない
- 同一ミーティングセッション中は再度ポップアップを表示しない（重複防止）

### F-03: ミーティングノート自動作成

- ユーザーが指定したテンプレートをもとにノートを作成する
- ノートのファイル名フォーマットは設定可能（例: `YYYY-MM-DD_HHmm_Meeting`）
- ノートの保存先フォルダは設定画面から指定可能
- テンプレートに埋め込み可能な変数:
  - `{{date}}`: 日付
  - `{{time}}`: 時刻
  - `{{app}}`: 検知したアプリ名（Zoom / Google Meet / Teams）

### F-04: ミーティング終了検知

- 対象アプリのプロセス終了を検知する
- 終了検知時の動作（設定で選択可能）:
  - 録音を自動停止する
  - 終了通知（Notice）を表示する
  - 何もしない

### F-05: 設定画面

- 監視対象アプリの有効/無効切り替え（Zoom / Google Meet / Teams 各トグル）
- プロセス監視間隔（秒）
- ミーティングノートのテンプレートファイルパス
- ミーティングノートの保存先フォルダ
- ノートのファイル名フォーマット
- ミーティング終了時の動作選択
- プラグイン全体の有効/無効

---

## 非機能要件

### パフォーマンス

- プロセス監視のCPU負荷を最小限に抑える（`child_process.exec` を軽量に実行）
- Obsidianの起動速度に影響を与えない（監視は `onload` 後に非同期で開始）

### 互換性

- Obsidian v1.0.0 以上を対象
- Audio Recorder（コアプラグイン）との連携を想定するが、未有効時でもエラーにならないこと
- Templater プラグインとの共存を考慮

### セキュリティ

- `child_process` の実行は `exec` ではなく `execFile` を優先し、コマンドインジェクションを防止
- 外部ネットワーク通信は行わない

---

## 技術構成

| 項目 | 内容 |
|---|---|
| 言語 | TypeScript |
| ビルド | esbuild（obsidian-sample-plugin 準拠） |
| API | Obsidian Plugin API |
| プロセス検知 | Node.js `child_process`（`pgrep` / `osascript`） |
| UI | Obsidian `Modal`, `Notice`, `Setting` |

## アーキテクチャ概要

```
┌─────────────────────────────────────────────┐
│              Meeting Detector Plugin         │
├──────────────┬──────────────┬───────────────┤
│  Process     │  UI Layer    │  Note         │
│  Monitor     │              │  Generator    │
│              │              │               │
│ - pgrep      │ - Modal      │ - Template    │
│ - osascript  │ - Notice     │ - File create │
│ - setInterval│ - Settings   │ - Variables   │
└──────┬───────┴──────┬───────┴───────┬───────┘
       │              │               │
       ▼              ▼               ▼
   OS Process    Obsidian API    Vault Files
```

---

## 公開ロードマップ

### Phase 1: MVP（v0.1.0）

- macOS対応のみ
- Zoom プロセス検知 + ポップアップ表示
- ミーティングノート作成（基本テンプレート）

### Phase 2: コア機能拡充（v0.2.0）

- Google Meet / Teams 対応追加
- Audio Recorder 連携（録音開始/停止）
- ミーティング終了検知

### Phase 3: 安定化・公開（v1.0.0）

- 設定画面の充実
- エラーハンドリング強化
- BRAT経由でベータ公開 → フィードバック収集
- obsidian-releases へPR → コミュニティプラグイン正式公開

---

## 公開手順

1. GitHubリポジトリを作成（obsidian-sample-plugin テンプレート使用）
2. `README.md` / `LICENSE`（MIT）を整備
3. GitHub Release を作成（`manifest.json`, `main.js`, `styles.css` をアップロード）
4. `obsidian-releases` リポジトリの `community-plugins.json` にPRを提出
5. Obsidianチームによるレビュー → マージで公開完了