# Changelog

All notable changes to the **KenEasy Gemini MCP Auto Helper** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
