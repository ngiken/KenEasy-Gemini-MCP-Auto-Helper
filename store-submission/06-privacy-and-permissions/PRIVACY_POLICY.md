# Privacy Policy for KenEasy Gemini MCP Auto Helper

**Last updated:** 2026-11-23  
**Extension Version:** 1.0.0

## 1. Overview
KenEasy Gemini MCP Auto Helper ("the Extension") is an open-source browser extension designed to automate permission approvals for MCP (Model Context Protocol) tools and continue action chips exclusively on Google Gemini (`https://gemini.google.com/*`).

The developer respects user privacy. This Extension operates entirely on the client side inside the user's browser. **It does not collect, record, process, sell, transmit, or share any personal data, conversation content, or telemetry.**

## 2. Information Handled by the Extension
The Extension interacts only with the web DOM of the active Google Gemini tab:
- **Button Labels & Confirmation Dialogs**: The Extension inspects visible button and chip texts (e.g. "Always allow", "Continue", "↪ Yes") to perform automated clicks as configured by the user.
- **Local User Preferences**: User settings (such as cooldown delays, breaker limits, drag position coordinates, and custom keywords) are stored solely on your computer via the standard Chrome `chrome.storage.local` API and `localStorage`.
- **Zero Third-Party Telemetry**: No third-party SDKs, analytics services (such as Google Analytics or Mixpanel), advertising trackers, or telemetry beacons are embedded in this Extension.

## 3. Network Communications
- The Extension **does not communicate with any external backend servers**.
- All script execution, token breaker algorithms, and DOM analysis occur strictly within your local browser sandbox.
- The Extension makes no outbound API calls.

## 4. Permissions Usage
- `storage`: Used solely to persist user configuration preferences and daily click statistics on your local device.
- `tabs`: Used to verify if the active tab is Google Gemini, monitor tab status, and bring the tab to focus when clicking a desktop notification.
- `alarms`: Used to schedule periodic background heartbeat checks in the service worker to prevent tasks from stalling while the browser window is inactive.
- `scripting`: Used to inject content scripts into already-open Google Gemini tabs when the extension is updated or reloaded without requiring a full browser restart.
- `notifications`: Used solely to display native operating system desktop alerts when an MCP tool execution or Gemini text generation hangs or stalls longer than the user-configured timeout threshold.
- Host Permissions (`https://gemini.google.com/*`): The Extension's scope is strictly restricted to `https://gemini.google.com/*`. It has no access to any other website, tab, or domain.

## 5. Children's Privacy
The Extension does not knowingly collect or solicit any information from anyone under the age of 13.

## 6. Open Source & Auditability
The Extension is open source under the MIT License. Anyone can inspect, build, and verify the source code at:  
https://github.com/ngiken/KenEasy-Gemini-MCP-Auto-Helper

## 7. Contact
If you have questions regarding this Privacy Policy or the Extension's security practices, please open an issue at:  
https://github.com/ngiken/KenEasy-Gemini-MCP-Auto-Helper/issues
