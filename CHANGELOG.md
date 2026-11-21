# Changelog

All notable changes to the **KenEasy Gemini MCP Auto Helper** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.0] - 2026-11-22

### ✨ Multi-Language, Light/Dark Mode, Drag & Multi-Window Guard Fixes (v0.2 Beta)

#### 🐛 Critical Bug Fixes
- **Fixed Floating HUD Hover-Sticking Drag Bug**:
  - Added strict left-button press gating (`isPointerDown`) so hovering or moving the mouse over `.gmah-header` never drags or sticks the HUD to the cursor.
  - Deferred `setPointerCapture` until after the 4px drag threshold is exceeded and excluded header buttons (`−`/`+`, theme toggle, language switch) from drag initiation so clicking to expand/collapse works reliably on the first click.
  - Deduplicated `pointer*` and `mouse*` listeners, added `buttons === 0` off-window auto-release (preserving final dragged coordinates), `blur` cleanup, `resize` viewport re-clamping, and a **Reset HUD Position** button in the popup.
- **Fixed Unintended Auto-Clicks on Non-Chat Pages & Secondary Browser Windows**:
  - Added `isNonChatGeminiUrl` route guard to pause automation on non-chat Gemini pages (`/gems`, `/extensions`, `/saved-info`, `/settings`, `/updates`, `/faq`, `/pricing`, `/about`, etc.).
  - Required at least one assistant response turn (`turns.length > 0`) before auto-clicking any continue/affirmative button, and removed overly broad `'开始'`/`'開始'` triggers from built-in defaults (with automatic `v2 -> v3` storage migration).
  - Required sibling approval context for standalone generic single-allow words (`允许`, `同意`, `Allow`, `Accept`) and required follow-up chip or latest-turn containment for generic affirmative replies (`Yes`, `确认`, `好的`).
  - Added `hasFocus()` check in Foreground-Only mode and `ignoreStaleInitialContinue` startup/navigation snapshot so restoring or switching to historical chats in a 2nd browser window never auto-clicks pre-existing stale chips.

#### 🆕 New Features
- **4-Language Interface & Keyword Support (`zh-CN`, `zh-TW`, `en`, `ja`)**:
  - Full live i18n across HUD, Popup, and OS desktop notifications, plus built-in Japanese and Cantonese/Traditional Chinese MCP approval and continue keywords.
  - Switch language seamlessly from either the HUD header pill or the Popup settings bar.
- **Dark & Light Mode (黑白深浅双模式)**:
  - Toggle between Dark Night and Light Daylight themes directly from the HUD (`☀` / `☾`) or Popup (`🌙` / `☀️`), synced in real time across tabs.
- **Redesigned 2x Retina Promotional & Store Assets**:
  - Rebuilt all README banners, feature walkthroughs, and Chrome Web Store screenshots/tiles at 2x DPI with clean non-overlapping Dark + Light showcases.

#### 🧪 Quality Assurance & Tests
- Expanded automated test suite to 49 unit and integration tests covering HUD hover-drag safety, off-window release, non-chat/0-turn/restored-tab guards, and 4-language/theme rendering (49/49 passing).

---

## [0.1.0] - 2026-11-21

### 🚀 Public Beta Initial Release (v0.1 Beta Preview)

The first public beta release of **KenEasy Gemini MCP Auto Helper**, an intelligent automation and workflow acceleration extension tailored specifically for Google Gemini (`gemini.google.com`).

#### ✨ Core Automation Features
- **Smart MCP Tool Permission Approval**:
  - Automatically identifies and clicks "Always allow / 始终允许" authorization dialogs on `gemini.google.com`.
  - Pierces through Material Web Components Shadow DOM, `<slot>` projected labels, and `role="menu"` dropdown items.
  - Safe fallback: Optionally falls back to clicking "Allow once / 允许一次" when no permanent option exists.
  - Strict context protection: Prevents clicking destructive buttons (Deny, Delete, Cancel, Block, Sign out).
- **Auto-Continue & Yes Action Chips**:
  - Automatically clicks confirmation follow-up chips (such as `↪ Yes` / `↪ 是`) and bottom "Continue" buttons.
  - Filters out surveys, long prompts, rating dialogs, and navigation history.
- **Background & Minimized Tab Operation**:
  - Sustains background execution through Port keep-alive heartbeats and `chrome.tabs.onUpdated` discard protection.

#### 🆕 New in v0.1
- **Freely Draggable Floating HUD (全域自由拖拽)**:
  - Header drag handle supporting smooth pointer tracking across the browser viewport.
  - Viewport boundary clamping guarantees the HUD never drifts off-screen.
  - 4px movement deadzone distinguishes clicks from drags, preventing accidental displacement when clicking the minimize button or pills.
  - Coordinate persistence: Automatically saves position in `localStorage` (`gmah_hud_position`) and restores upon reload.
- **Desktop Stall Alerts & One-Click Toggle (一键启停桌面通知)**:
  - Triggers native desktop notifications and flags a red `!` toolbar icon badge if tool execution hangs or model output stalls longer than the configured threshold (default 5 minutes).
  - 1-Click interactive toggle pill (`桌面通知: [已开启 / 已关闭]`) directly inside the on-page HUD.
  - Prominent toggle switch and "Test Notification" button in the popup panel.
  - Immediately purges and clears pending desktop notifications upon deactivation.

#### 🛡️ Circuit Breaker Subsystem (6-Layer Anti-Loop Protection)
- **Layer 1 (Error Cutoff)**: Immediate halt on quota exhaustion, rate limit, or server error keywords.
- **Layer 2 (Per-Task Limit)**: Caps consecutive continue clicks per task (default 10); resets automatically on new user prompts.
- **Layer 3 (Output Settle Guard)**: Enforces streaming idle settle delay (1.8s) followed by click cooldown (4s).
- **Layer 4 (Daily Continue Limit)**: Optional daily continue cap (default 0 = unlimited); resets automatically at midnight.
- **Layer 5 (Completion Semantics)**: Skips continue when task completion cues are detected without truncation.
- **Layer 6 (Stagnant Output Breaker)**: Hash-based repetition detection halts bot loops if DOM content does not advance.

#### 🧪 Quality Assurance & Tests
- Comprehensive automated regression suite: 45 unit and integration tests under `tests/` covering manifest, assets, keyword parsing, breaker boundaries, draggable HUD, and background notification lifecycles (45/45 passing).
