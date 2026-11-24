# Changelog

All notable changes to the **KenEasy Gemini MCP Auto Helper** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.2] - 2026-11-24

### 🎯 Default Model Lock & Auto-Switch Guard (`defaults.js`, `content.js`, `background.js`, `hud.js`, `hud.css`, `popup.html`, `popup.js`, `popup.css`)
- **Automatic Default Model Enforcement (`modelLockEnabled`, `preferredModel`)**:
  - Users can configure a default working model (via presets, free-text input, or one-click **"Use Current" / "Detect Models"** in both the Floating HUD and Extension Popup) and lock it globally or independently per conversation (`CHAT_OVERRIDE_KEYS`).
  - Whenever Gemini is idle (including brand-new `/app` chats, before clicking **Continue**, and before **Stall Auto-Recovery** sends its reconnect prompt), the engine verifies the active model and automatically switches back if it drifted or was reset, without interrupting active streaming or MCP tool execution.
- **Smart Cross-Language Matching & Adversarial Guard (`scoreModelMatch`, `isModelNameMatch`)**:
  - Supports cross-language canonical aliases (`Fast` / `快速` / `高速`, `Thinking` / `思考` / `思考模式` / `思考モード` / `深度思考`), brand-prefix normalization (`2.5 Pro` ↔ `Gemini 2.5 Pro`), and `.0` version normalization (`3.0 Pro` ↔ `3 Pro`).
  - Strictly blocks upsell/promotional items (`Upgrade to Google AI Pro`, `升级`, etc.), cross-tier collisions (e.g., target `Pro` will never match `Thinking with 3 Pro`), and decoy buttons inside `<model-response>`, `<nav>`, or `<code>`.
- **Hard Error Stop & Anti-Flap Protection (`model_unavailable`)**:
  - Cleanly dismisses open menus and stops all automation (Allow, Continue, and Stall Auto-Recovery) when the preferred model is disabled/quota-locked, missing from the picker, rejected by a rate-limit snackbar, lacks a usable switcher, or keeps being reverted by Gemini beyond `maxModelSwitchRetries` (configurable 1–10, default 3).
  - Displays a red status indicator in HUD/Popup, sets a red `ERR` toolbar badge, and sends a localized OS desktop notification in `background.js` (clicking the alert restores and focuses the affected Gemini tab).
- **Multi-Size, Zoom & Background/Minimized Hardening**:
  - Detects model switchers across desktop `<header>` bars, bottom prompt composers, nested ShadowRoots, duplicate responsive triggers (prioritizing strictly visible active triggers), narrow/mobile icon-only triggers + `mat-bottom-sheet-container`, and Angular Material nested menu wrappers while ignoring hidden check/lock icons.
  - Prevents background double-toggling of opened model menus in both `content.js` and `background.js` (`mainWorldClickByToken`), scrolls menu options into view on short screens, and adds responsive HUD clamping (`max-width`, `max-height`, scrollable `.gmah-body`, compact `@media` rules, and `visualViewport` resize tracking).
- **Documentation & Verification**:
  - Repaired `README.md` and `README.zh-CN.md` changelog history (restoring `v1.0.1` and aligning `v2.0` + `v2.2` entries) and expanded automated verification to **129/129 passing tests** across 8 suites (`tests/test_model_lock.js`).

---

## [2.0] - 2026-11-24

### 🚀 Background, Minimized & Screen-Off / Sleep Continuity Overhaul (`content.js`, `manifest.json`, `defaults.js`, `popup.html`)
- **Version 2.0 Bump**:
  - Updated `manifest.json` `"version"` to `"2.0"` and aligned HUD/Popup release badges and localized labels to `2.0` / `v2.0`.
- **Enhanced Background, Minimized & Screen-Off / Sleep Detection (`isBackgroundOrUnfocused`)**:
  - Expanded visibility and window-state checks to cover minimized or occluded windows (`minimized`, `isMinimized`, `windowState === 'minimized'`, zero dimensions, off-screen coordinates, and `!doc.hasFocus()`).
- **Immediate `MAIN`-World Click Escalation in Background / Minimized / Unfocused States**:
  - Triggered `MAIN`-world click escalation (`triggerMainWorldClick`) on initial clicks for both `Always allow` and `Continue` chips when the tab is hidden, minimized, or unfocused in addition to retry and stall-recovery send flows.
- **Post-Sleep / Screen-Off / Visibility Wakeup Recovery**:
  - Re-acquires the shared background keepalive Web Lock (`syncBackgroundKeepaliveLock`), rotates/reconnects the Service Worker port (`forceReconnectBackgroundPort`), and sends a `GMAH_TAB_KEEPALIVE` wakeup when returning from hidden, screen-off, or sleep states.
- **Test Suite & Package Alignment**:
  - Updated version and background/sleep wakeup tests (`116/116` passing) and rebuilt `v2.0` store and manual-install packages alongside updated store listing and permission files.

---

## [1.0.1] - 2026-11-24

### 🎨 Notion-Style UI Complete Refactor (`hud.css`, `popup.css`, `popup.html`, `hud.js`)
- **Paper Light & Charcoal Dark Neutral Palette**:
  - Rebuilt both Floating HUD and Popup stylesheets around Notion's signature flat aesthetic: warm paper light (`#FFFFFF / #F7F6F3`, `#37352F` ink) and calm charcoal dark (`#191919 / #1F1F1F / #262626`, `#E6E6E4` text), 1px hairline borders, subtle hover fills, restrained radii, and low-saturation semantic tones (`#0F7B6C` green, `#2383E2` blue, `#D9730D` amber, `#EB5757` red) with zero neon glows.
- **Refined Component Layout & Zero-`innerHTML` Compliance**:
  - Restructured Popup's per-chat header into a clean two-row layout preventing text wrapping at `382px` width; added active-state highlights (`.gmah-action-active`) for HUD Logs/Inspect drawers plus inline **Clear Logs** and **Refresh Inspect** toolbars while preserving strict Trusted Types CSP compatibility.
- **Automated Visual Verification**:
  - Added `assets/render_notion_preview.py` to capture real-DOM 2x headless Chrome previews (`assets/notion-ui-preview.png` and individual light/dark Popup & HUD captures).

### 🎛️ Per-Chat Independent Controls & Isolated Emergency Stop (`defaults.js`, `content.js`, `hud.js`, `popup.html`, `popup.js`)
- **Per-Conversation Override Persistence (`gmah_chat_overrides_v1`)**:
  - Added URL-based conversation key extraction (`extractConversationKey`) supporting `/app/<id>`, `/u/<n>/app/<id>`, `/gem/<gemId>/<chatId>`, and `/app` landing (with automatic override migration to `/app/<newId>` upon creating a new chat).
  - Each conversation can independently enable or disable 6 core controls (`enabled`, `autoAllow`, `autoContinue`, `backgroundMode`, `stallAlertEnabled`, `stallAutoRecoverEnabled`) without altering global defaults or other open tabs.
- **Isolated Single-Chat Emergency Stop**:
  - Triggering **Emergency Stop** in HUD or Popup now stops **only the current conversation** and persists its stopped state across SPA navigation (auto-restoring when returning to that chat while other conversations keep running normally).
  - Popup now features a dedicated top **「当前对话独立控制 / This Conversation」** card (6 independent toggles, override indicator, **Stop/Resume this chat**, and **Reset to global**) alongside a separate **「停止全部对话 / Stop All Chats」** broadcast button.
- **HUD Scope Switcher**:
  - Added a Notion-style segmented **「本对话 / 全局默认」** switcher, conversation ID pill, per-row blue custom override indicators, and one-click **「恢复全局」** reset right inside the floating HUD.

### ⚡ Background & Minimized Window Clicking Hardening (`background.js`, `content.js`)
- **MAIN-World Click Escalation (`mainWorldClickByToken`, `GMAH_MAIN_WORLD_CLICK`)**:
  - Added self-contained `MAIN`-world click execution piercing ShadowRoots and Angular Material chips (`<mat-chip>`, `<suggestion-chip>`, MWC) when isolated-world clicks are throttled or ignored in hidden/minimized tabs—now covering Allow retries, Continue retries, and Stall-Recovery Stop/Send buttons.
- **Per-Chat Background Heartbeat & Discard Isolation**:
  - `background.js` now loads and listens to `gmah_chat_overrides_v1` with precise per-tab evaluation (`isTabBackgroundActive`), keeping Service Worker heartbeats and `autoDiscardable: false` active for chats that individually enable background mode even if global background mode is off, without leaking to other tabs or emergency-stopped chats.
- **Minimized Window Follow-Up Wakeup**:
  - When Chrome loses focus or minimizes (`windowId === -1`), `handleWindowFocusChanged` schedules an extra `1200ms` follow-up wake tick (`window_minimized_followup`) for background-active tabs to prevent compositor-throttled misses.

### 🛡️ Deep Boundary Stress, Concurrency & Defensive Hardening
- **DOM / ShadowRoot Cycle Defense (`content.js`)**:
  - Guarded `collectSearchRoots` with `depth < 32` and `visited = new Set()` to completely prevent `RangeError: Maximum call stack size exceeded` in adversarial or cyclic Shadow DOM structures.
- **Throwing DOM API Isolation (`content.js` / `hud.js`)**:
  - Wrapped `querySelectorAll` in `queryAllFromRoots`, and all `getBoundingClientRect()` / `getComputedStyle()` calls across content engine and HUD in `try ... catch` blocks with safe bounding fallbacks.
- **Ancestor Traversal Depth Bounds (`content.js`)**:
  - Hardened all 13 ancestor/parent traversal loops (`isIgnoredAncestor`, `hasAncestorRoleOrTag`, `isElementVisible`, `collectClickableElements`, `containsDeep`, `isInsideHudOrNonComposer`, `findClosestButtonAncestor`, `isInsideRichTextareaOrInputArea`, `hasClickedSiblingButton`, `hasSiblingApprovalContext`, `isNoisyMutationTarget`, `isFollowUpChipElement`, `hasNegativeSiblingInGroup`) with strict `depth < 64` guards, `visited = new Set()`, and exception handling.
- **Timing & Backward NTP Clock-Skew Defense (`content.js`)**:
  - Implemented `safeNow()` and `sanitizeTimestamps(now)` to clamp past event timestamps on backward clock jumps (NTP synchronization or DST rollbacks), ensuring cooldowns, settle delays, and stall monitors never freeze (clamped `retryInMs <= 30000ms`).
- **ReDoS & Oversized Keyword Guards (`defaults.js`)**:
  - Added 256-character length guards before dynamic regular expression creation in `containsKeyword` and skipped oversized keywords in `matchButtonLabel`, wrapping all regex compilation in `try ... catch` with `.includes()` fallback to eliminate `SyntaxError: Regular expression too large` and ReDoS lockups.
- **Prototype Pollution Isolation (`defaults.js`)**:
  - Explicitly filtered `__proto__`, `constructor`, and `prototype` keys in `sanitizeKeywordArray`.
- **Multi-Tab Stall Notification Isolation (`content.js`)**:
  - Removed `GMAH_CLEAR_ALL_STALL_NOTIFICATIONS` from `onStallResolved()` so resolving a stall in one tab sends only tab-specific `GMAH_STALL_CLEAR`, preserving active stall alerts and desktop notifications in other concurrent tabs.
- **Tab Navigation Cleanup (`background.js`)**:
  - In `handleTabUpdated`, detect when a monitored tab navigates away from Gemini to an external URL and cleanly unregister its port, badge, scheduled ticks, and stall alerts via `handleTabRemoved(tabId)`.
- **Breaker Badge Persistence & Restoration (`background.js`)**:
  - Persisted `breakerBadgeMap` in `chrome.storage.session` to restore active breaker badges across Service Worker restarts while preventing stall clear operations from clobbering active breaker badges.
- **Port Rotation Race Hardening (`content.js`)**:
  - Tagged rotating ports with `port.__gmahRotating = true` prior to disconnect, preventing asynchronous `onDisconnect` events from triggering redundant duplicate reconnects.
- **Web Locks Atomic Stats Write (`content.js`)**:
  - Wrapped statistics read-modify-write (`flushPendingStatsDelta`) in Web Locks API (`navigator.locks.request('gmah_stats_write_lock', ...)`) with graceful fallback, preventing undercounts from concurrent multi-tab writes.
- **Memory Bounding & Early-Return Pruning (`content.js`)**:
  - Enforced a strict 500-entry FIFO maximum capacity on `clickedElements` and `clickAttempts` (`boundTrackingSets`), and pruned unmounted/disconnected DOM nodes unconditionally at the start of `scanOnce()` before any disabled/early return.
- **HUD Event Listener Deduplication & Mid-Drag State Commit (`hud.js`)**:
  - Guarded window event listener attachment (`resize`, `blur`, `pagehide`, `beforeunload`) to attach exactly once per HUD lifecycle, eliminating listener leaks on rapid re-mounts (<= 12 listeners across 10 mounts), and safely committed position via `savePosition` if blur or pagehide interrupts a drag mid-flight.

### 🛠️ Background, Occlusion & Minimized Window Deep Optimization
- **Non-Fullscreen & Occluded Window Auto-Continue Fix (`content.js`)**:
  - Relaxed hidden layout checks (`relaxHiddenLayout`) whenever `isBackgroundOrUnfocused(doc)` is active (`doc.hidden || !doc.hasFocus()`), solving the Chromium compositor bug where paused CSS fade-in animations left buttons at `opacity: 0` and blocked clicking.
- **Windows Real Minimization Detection Fix (`content.js`)**:
  - Removed flawed assumption that minimized windows in Windows Chrome have `innerWidth === 0`; now properly detects Windows taskbar minimization (`screenX <= -32000`, `windowState === 'minimized'`, etc.).
- **Lingering Generation Spinner Deadlock Release (`content.js`)**:
  - Extended the 2.2-second frozen spinner bypass in `detectGenerating` to all unfocused and background states while adding explicit safeguards (`hasActiveToolOrThinking` and `connectingText`) so active MCP tool calls and deep thinking phases are never cut short.
- **Deep Button Piercing (`resolveClickTarget`)**:
  - Enhanced click resolution to directly pierce `<mat-chip>`, `<mat-chip-option>`, `<suggestion-chip>` and nested Shadow DOM inner buttons on background attempts.
- **Expanded Keyword Coverage (`defaults.js`)**:
  - Added traditional Chinese, Cantonese, and English continue keywords (`接續`, `接着写`, `接着说`, `keep writing`, `continue answering`, etc.).
- **Cold-Start Storage Safeguard (`content.js`)**:
  - Added a 1.5s fallback timer ensuring `settingsReady` activates with defaults even if `chrome.storage.local.get` is delayed by background tab throttling on cold start.
- **All 115 Automated Tests Passing**:
  - Verified across 7 comprehensive test suites in `tests/run_all.js` (81 regression + 27 deep boundary stress/fuzz + 7 per-chat override, isolated emergency stop, MAIN-world click & Notion UI tests).

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
