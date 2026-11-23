# Changelog

All notable changes to the **KenEasy Gemini MCP Auto Helper** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-11-23

### 🎉 Official Stable Release (v1.0.0)

#### ✨ New Features
- **Stall Auto-Stop & Custom Reconnect Prompt (`defaults.js` / `content.js` / `popup.html` / `popup.js` / `hud.js`)**:
  - Automatically detects when Gemini or an MCP tool (such as Desktop Commander) has been stuck connecting/waiting for the configured threshold (default **5 minutes**, adjustable 1–60 minutes), cancels the stuck turn, and sends a customizable reconnect message (default: **`继续，刚才mcp连接断开了`**, editable up to 200 characters in Popup).
  - Includes draft protection (never overwrites user-typed unsent text), quota/error circuit-breaker check, and per-task max auto-recovery cap (default 3, auto-resets upon new response progress).
- **Live Connection / Wait Elapsed Timer (`content.js` / `hud.js` / `popup.js`)**:
  - Displays live wait duration and connecting status label right in the floating HUD (e.g., `⏳ 正在连接 Desktop Commander · 已等 2分15秒 / 5分钟`) and Popup live status, turning amber as it approaches the threshold.
  - Strips volatile connecting status text from response progress fingerprints so animated timers/ellipsis inside `<model-response>` never falsely reset the stall clock.
- **One-Click Immediate "Resume Now" Button (`hud.js` / `popup.html` / `content.js`)**:
  - Added an immediate **「立即续接 / Resume Now」** button right next to the HUD stall auto-recovery toggle (and in Popup) to force stop + send the reconnect message immediately without waiting for the timeout.
- **Human-Like Anti-Throttling Pacing (`humanPacingEnabled`, default ON)**:
  - Applies randomized natural delays after stopping (2.0–3.4s auto / 1.5–2.4s manual), character-by-character / chunked typing (140–280ms per step), pre-send review pauses (1.1–2.2s auto / 0.9–1.7s manual), natural hover + safe off-center click coordinates, and a 60-second rolling anti-burst governor to prevent rapid-action rate-limiting.
- **Settings Migration v4 → v5 & Smooth Live Editing**:
  - Automatically upgrades the legacy `'继续'` default to `'继续，刚才mcp连接断开了'` while preserving user-customized prompts; prevents Popup debounced auto-save from overwriting an actively focused text input mid-keystroke.
- **Circuit Breaker Desktop Alerts & Badge Wiring (`content.js` / `background.js`)**:
  - Wired `GMAH_BREAKER_ALERT` / `GMAH_BREAKER_CLEAR` across runtime messages and long-lived Port handshakes (`GMAH_TAB_HELLO`), displaying an amber `!!` badge + localized OS notification for non-emergency breaker trips (and a silent red `!` badge for manual Emergency Stop), restoring/focusing the corresponding Gemini tab on notification click, and cleaning up cleanly on tab close or breaker reset.
- **Quality Assurance & Tests**:
  - Expanded automated test suite to **76 passing tests** across 5 suites covering end-to-end circuit breaker alert wiring, stall auto-recovery, custom reconnect prompt chunk typing, Web Lock anti-freeze hardening, and 30-minute background marathon resilience.

---

## [0.3.0] - 2026-11-22

### 🚀 Ultimate Background Persistence, Smart Click Retries & UI Stability Overhaul (v0.3 Beta)

#### 🔥 Background & Minimized Tab Reliability Fixes
- **MV3 Service Worker Never-Sleep Keepalive & 4-Min Seamless Port Rotation (`background.js` / `content.js`)**:
  - Added periodic lightweight `chrome.runtime.getPlatformInfo` keepalive calls (~19.5s) while Gemini tabs are active so Chrome MV3 never terminates the Service Worker after 30 seconds of idle time.
  - Added proactive 4-minute Port rotation (`GMAH_ROTATE_PORT`) before Chrome's 5-minute hard disconnect limit, plus `GMAH_TAB_KEEPALIVE` wakeup before reconnecting on unexpected drops.
  - Added `chrome.tabs.onActivated`, `chrome.windows.onFocusChanged`, `window.blur`, and `window.focus` listeners to wake and scan Gemini tabs the instant you switch tabs or Alt+Tab to another application.
- **Unthrottled Service Worker Delayed Tick Scheduling (`GMAH_SCHEDULE_TICK`)**:
  - Solved the background `settling` / `cooldown` deadlock: whenever a hidden or unfocused tab waits for output settle (`1.8s`) or cooldown (`4s`), it delegates an unthrottled delayed callback to the Service Worker so Chrome's 1-minute background timer throttling can never freeze Auto-Continue.
- **Shadow DOM Recursive MutationObserver & Noise Filtering**:
  - Automatically attaches `MutationObserver` into open `ShadowRoot` trees (including dynamically mounted Material Web Components), while ignoring `.mat-ripple` and `role="tooltip"` UI noise so idle settle timers aren't endlessly reset.
- **Minimized-Window False `isGenerating` Lock Fix**:
  - Strengthened visibility checks for loading spinners and Stop buttons (`opacity: 0`, `0px` dimensions, `scale(0)`, `.ng-hide`) so hidden/collapsed spinners in minimized windows (`0×0` viewport) never permanently block Auto-Continue.
- **Safe Background Click Retry with MWC Shadow Piercing**:
  - If a permission Allow or Continue button fails to dismiss while the tab is hidden/unfocused, the engine safely retries once after 2.5s / 3.5s (max 2 attempts) with center coordinates, safe `focus({ preventScroll: true })`, and `@material/web` ShadowRoot inner `<button>` piercing — without double-counting stats or falsely tripping `stagnant_output`.
- **Smart Non-Duplicate Tab Probing**:
  - Probes tabs with `GMAH_GET_STATE` before dynamic script injection so existing Gemini tabs never receive duplicate `hud.css` / script injections.

#### 🐛 Everyday UX & Logic Bug Fixes
- **Fixed HUD Snapping to `(0, 0)` on Windows Minimize**: `hud.js` now ignores minimized `0×0` resize events, preserving your exact HUD coordinates when restoring the browser window.
- **Fixed HUD Off-Screen Clipping on Expand / Panel Open**: Expanding a minimized HUD or opening the Logs / Inspect panel automatically re-clamps the HUD inside the viewport.
- **Eliminated Duplicate Drag Events & Unnecessary DOM Re-renders**: Deduplicated bubbling `pointer*`/`mouse*` events, extended post-drag click lock to 250ms, guarded async position restoration during active drags, and added render-signature diffing to eliminate redundant 900ms HUD repaints.
- **Fixed New Chat `/app` → `/app/<chatId>` Suppression**: Creating a brand-new conversation from `/app` no longer falsely suppresses the first Continue button, while switching between historical chats still protects against stale chips.
- **Fixed Split Inline `<span>` Labels, Zero-Width Chars, Cookie Guard & Live 4-Language Status**: Strips zero-width characters while inserting spaces between split ASCII spans (e.g. `<span>Always\u200B</span><span>allow</span>` → `"Always allow"`), protects both `alwaysAllow` and `singleAllow` against cookie/notification/camera/mic/location prompts across all 4 languages, lets explicit `"Continue generating"` buttons override completion cues across all supported locales, and localizes all live engine status and breaker messages (with 100% i18n key & placeholder parity across `zh-CN`/`zh-TW`/`en`/`ja`).
- **Popup Auto-Save & Race-Free Breaker Reconciliation**: Numeric inputs and custom keywords now auto-save on change/input and immediately push `GMAH_APPLY_SETTINGS` to open Gemini tabs so raising limits clears tripped breakers instantaneously; multi-tab stats use serialized delta-merged storage writes.

#### 🧪 Quality Assurance & Tests
- Expanded automated test suite to **64 tests** across 5 suites including a **30-minute background marathon VM sandbox** (7+ Port rotations, SW crash recovery, frozen background timers), recycled DOM node verification, 3-level Shadow DOM + 500-mutation noise storm, 20+ adversarial false-positive matrix, 4-language i18n parity audit, and multi-tab concurrent stats merge (**64/64 passing**).

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
  - Required at least one assistant response turn (`turns.length > 0`) before auto-clicking any continue/affirmative button, and removed overly broad localized "Start" triggers from built-in defaults (with automatic `v2 -> v3` storage migration).
  - Required sibling approval context for standalone generic single-allow words (`Allow`, `Accept`, and localized equivalents) and required follow-up chip or latest-turn containment for generic affirmative replies (`Yes`, `Confirm`, and localized equivalents).
  - Added `hasFocus()` check in Foreground-Only mode and `ignoreStaleInitialContinue` startup/navigation snapshot so restoring or switching to historical chats in a 2nd browser window never auto-clicks pre-existing stale chips.

#### 🆕 New Features
- **4-Language Interface & Keyword Support (`zh-CN`, `zh-TW`, `en`, `ja`)**:
  - Full live i18n across HUD, Popup, and OS desktop notifications, plus built-in Japanese and Cantonese/Traditional Chinese MCP approval and continue keywords.
  - Switch language seamlessly from either the HUD header pill or the Popup settings bar.
- **Dark & Light Mode**:
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
  - Automatically identifies and clicks "Always allow" authorization dialogs (and localized equivalents) on `gemini.google.com`.
  - Pierces through Material Web Components Shadow DOM, `<slot>` projected labels, and `role="menu"` dropdown items.
  - Safe fallback: Optionally falls back to clicking "Allow once" when no permanent option exists.
  - Strict context protection: Prevents clicking destructive buttons (Deny, Delete, Cancel, Block, Sign out).
- **Auto-Continue & Yes Action Chips**:
  - Automatically clicks confirmation follow-up chips (such as `↪ Yes`) and bottom "Continue" buttons.
  - Filters out surveys, long prompts, rating dialogs, and navigation history.
- **Background & Minimized Tab Operation**:
  - Sustains background execution through Port keep-alive heartbeats and `chrome.tabs.onUpdated` discard protection.

#### 🆕 New in v0.1
- **Freely Draggable Floating HUD**:
  - Header drag handle supporting smooth pointer tracking across the browser viewport.
  - Viewport boundary clamping guarantees the HUD never drifts off-screen.
  - 4px movement deadzone distinguishes clicks from drags, preventing accidental displacement when clicking the minimize button or pills.
  - Coordinate persistence: Automatically saves position in `localStorage` (`gmah_hud_position`) and restores upon reload.
- **Desktop Stall Alerts & One-Click Toggle**:
  - Triggers native desktop notifications and flags a red `!` toolbar icon badge if tool execution hangs or model output stalls longer than the configured threshold (default 5 minutes).
  - 1-Click interactive toggle pill (`Desktop Alert: [On / Off]`) directly inside the on-page HUD.
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
