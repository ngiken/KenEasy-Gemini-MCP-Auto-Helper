# Privacy Policy for KenEasy Gemini MCP Auto Helper

**Last updated:** 2026-11-24  
**Extension Version:** 1.0.1

## 1. Overview
KenEasy Gemini MCP Auto Helper ("the Extension") is an open-source browser extension designed to automate permission approvals for MCP (Model Context Protocol) tools, continuation confirmation chips, per-conversation controls, and stall auto-recovery exclusively on Google Gemini (`https://gemini.google.com/*`).

The developer respects user privacy. This Extension operates entirely on the client side inside the user's browser. **It does not collect, record, process, sell, transmit, or share any personal data, conversation content, or telemetry.**

## 2. Information Handled by the Extension
The Extension interacts only with the web DOM of the active Google Gemini tab:
- **Button Labels & Confirmation Dialogs**: The Extension inspects visible button and chip texts (e.g. "Always allow", "Continue", "↪ Yes") to perform automated clicks as configured by the user.
- **Local User Preferences & Per-Chat Overrides**: Global settings (such as cooldown delays, breaker limits, theme/language, HUD position coordinates, and custom keywords), daily click statistics, and per-conversation override flags / isolated emergency-stop states (`gmah_chat_overrides_v1`) are stored solely on your local device via Chrome's `chrome.storage.local` API (with `localStorage` fallback for HUD layout).
- **Zero Third-Party Telemetry**: No third-party SDKs, analytics services (such as Google Analytics or Mixpanel), advertising trackers, or telemetry beacons are embedded in this Extension.

## 3. Network Communications
- The Extension **does not communicate with any external backend servers**.
- All script execution, circuit-breaker algorithms, and DOM analysis occur strictly within your local browser sandbox.
- The Extension makes no outbound API calls and loads no remote code.

## 4. Permissions Usage
- `storage`: Used solely to persist global user preferences, daily local click statistics, and per-conversation override / isolated emergency-stop settings (`gmah_chat_overrides_v1`) on your local device.
- `tabs`: Used to verify if the active tab is Google Gemini, read its conversation path for per-chat control matching, toggle `autoDiscardable` on background-enabled Gemini tabs to prevent premature discarding, and bring the tab to focus when clicking a desktop alert notification.
- `alarms`: Used to schedule periodic background heartbeat checks and minimized-window follow-up wakeups in the Manifest V3 service worker to prevent tasks from stalling while the browser window is inactive.
- `scripting`: Used exclusively on `https://gemini.google.com/*` tabs to (1) inject bundled content scripts into already-open Gemini tabs upon install or update without requiring a browser restart, and (2) run a strictly local, self-contained `world: "MAIN"` click helper (`mainWorldClickByToken`) and lightweight renderer wake ping when background or minimized tab throttling blocks isolated-world clicks on Shadow DOM or Angular Material chips. No remote code is fetched or executed.
- `notifications`: Used solely to display native operating system desktop alerts when an MCP tool execution or Gemini text generation hangs or stalls longer than the user-configured timeout threshold or when a safety circuit breaker trips.
- Host Permissions (`https://gemini.google.com/*`): The Extension's scope is strictly restricted to `https://gemini.google.com/*`. It has no access to any other website, tab, or domain.

## 5. Children's Privacy
The Extension does not knowingly collect or solicit any information from anyone under the age of 13.

## 6. Open Source & Auditability
The Extension is open source under the MIT License. Anyone can inspect, build, and verify the source code at:  
https://github.com/ngiken/KenEasy-Gemini-MCP-Auto-Helper

## 7. Contact
If you have questions regarding this Privacy Policy or the Extension's security practices, please open an issue at:  
https://github.com/ngiken/KenEasy-Gemini-MCP-Auto-Helper/issues
