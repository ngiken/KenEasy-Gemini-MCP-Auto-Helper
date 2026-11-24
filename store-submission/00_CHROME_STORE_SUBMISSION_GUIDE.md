# Chrome Web Store 上架全流程手把手操作指引 (KenEasy Gemini MCP Auto Helper)

> 本文件為 **KenEasy Gemini MCP Auto Helper (v1.0.1)** 的 Chrome 官方商店上架與更新一站式操作手冊。
> 本資料夾 `store-submission/` 內已分類準備好所有需上傳的軟體包、圖示、5 張 Notion 風格高清宣傳截圖、2 張推薦橫幅、4 種語言文案、v1.0.1 更新說明與隱私權審查文件。
> 你只需打開 [Chrome Web Store 官方開發者控制台](https://chrome.google.com/webstore/devconsole)，按照下方步驟依序複製貼上即可！

---

## 📁 本資料夾結構與對應清單

```text
store-submission/
├── 00_CHROME_STORE_SUBMISSION_GUIDE.md    <-- 你正在閱讀的總操作指引
├── 01-package/
│   └── KenEasy-Gemini-MCP-Auto-Helper-store.zip   <-- [步驟 1] 需上傳的擴充功能壓縮包 (v1.0.1)
├── 02-store-icon/
│   └── icon-128x128.png                           <-- [步驟 2] 商店圖示 (128x128 PNG)
├── 03-screenshots/                                <-- [步驟 2] 5 張官方規定 1280x800 Notion 風格截圖
│   ├── screenshot-1-mcp-auto-approval-1280x800.png
│   ├── screenshot-2-draggable-hud-1280x800.png
│   ├── screenshot-3-desktop-notifications-1280x800.png
│   ├── screenshot-4-popup-settings-1280x800.png
│   └── screenshot-5-circuit-breaker-protection-1280x800.png
├── 04-promotional-tiles/                          <-- [步驟 2] 推薦促銷橫幅
│   ├── small-promo-tile-440x280.png               <-- 小促銷圖 (440x280)
│   └── marquee-promo-tile-1400x560.png            <-- 大宣傳條幅 (1400x560)
├── 05-listing-texts/                              <-- [步驟 2] 多語言文字介紹與更新日誌 (直接複製)
│   ├── LISTING_zh_CN.txt                          <-- 簡體中文文案 (v1.0.1)
│   ├── LISTING_zh_TW.txt                          <-- 繁體中文文案 (v1.0.1)
│   ├── LISTING_en.txt                             <-- 英文文案 (v1.0.1，預設語言)
│   ├── LISTING_ja.txt                             <-- 日文文案 (v1.0.1)
│   └── WHATS_NEW_v1.0.1.txt                       <-- v1.0.1 更新說明（英/繁/簡）
└── 06-privacy-and-permissions/                    <-- [步驟 3] 隱私政策與權限理由說明 (v1.0.1)
    ├── PERMISSIONS_JUSTIFICATIONS_FOR_REVIEWER.txt<-- 審查員權限理由 (含單對話覆寫與 MAIN 世界點擊)
    ├── DATA_DISCLOSURE_DECLARATION.txt            <-- 數據收集聲明選項勾選指引
    └── PRIVACY_POLICY.md                          <-- 隱私政策全文 (v1.0.1)
```

---

## 🚀 五步完成 Chrome 商店上架／版本更新

### 步驟 1：登入並上傳軟體包 (Package)
1. 打開瀏覽器訪問：**[Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)**。
2. 新上架點擊 **「新增項目」（New Item）**；更新既有項目則進入項目頁左側 **「軟體包」（Package）** → **「上傳新軟體包」（Upload new package）**。
3. 上傳檔案：
   - 檔案路徑：`store-submission/01-package/KenEasy-Gemini-MCP-Auto-Helper-store.zip`
4. 上傳完成後，系統會自動解壓並驗證 `manifest.json`（版本 `1.0.1`），確認無誤後繼續下一步。

---

### 步驟 2：填寫商店資訊與圖片 (Store Listing)

在左側選單點擊 **「商店資訊」（Store listing）**：

#### 1. 基本資訊 (Basic details)
- **預設語言 (Default language)**：建議選擇 `English` 或 `Chinese (Simplified)`。
- **擴充功能名稱 (Name)** 與 **說明 (Summary & Description)**：
  - 打開 `store-submission/05-listing-texts/` 中對應語言的 `.txt` 檔案，將 **標題**、**132 字簡短說明**、**詳細說明** 一鍵複製貼入相應欄位。
  - 若為版本更新，可從 `store-submission/05-listing-texts/WHATS_NEW_v1.0.1.txt` 複製對應語言的更新日誌。
- **類別 (Category)**：選擇 **「生產力工具」（Productivity）** 或 **「開發者工具」（Developer Tools）**。

#### 2. 圖形資產 (Graphic assets)
- **商店圖示 (Store icon)**：
  - 上傳 `store-submission/02-store-icon/icon-128x128.png`。
- **螢幕截圖 (Screenshots - 需 1280x800)**：
  - 依序上傳 `store-submission/03-screenshots/` 資料夾內的 5 張 v1.0.1 Notion 風格截圖：
    1. `screenshot-1-mcp-auto-approval-1280x800.png`（MCP 自動放行 + 背景/最小化 MAIN 世界點擊）
    2. `screenshot-2-draggable-hud-1280x800.png`（單對話獨立控制 & 隔離緊急停止 + 淺色紙感/深色炭灰 HUD）
    3. `screenshot-3-desktop-notifications-1280x800.png`（連線卡死即時計時 + 超時自動續接 & 桌面告警）
    4. `screenshot-4-popup-settings-1280x800.png`（真實 DOM Notion 淺色/深色設定彈窗）
    5. `screenshot-5-circuit-breaker-protection-1280x800.png`（6 層防刷熔斷 + 115 測試防線）
- **促銷圖標 (Promotional tiles)**：
  - **小促銷圖 (Small promo tile, 440x280)**：上傳 `store-submission/04-promotional-tiles/small-promo-tile-440x280.png`。
  - **大型宣傳橫幅 (Marquee promo tile, 1400x560)**：上傳 `store-submission/04-promotional-tiles/marquee-promo-tile-1400x560.png`。

#### 3. 官方網站與支援 (Official URLs)
- **官方網站 / 程式碼庫網址 (Homepage URL)**：
  `https://github.com/ngiken/KenEasy-Gemini-MCP-Auto-Helper`
- **支援網址 (Support URL)**：
  `https://github.com/ngiken/KenEasy-Gemini-MCP-Auto-Helper/issues`

---

### 步驟 3：隱私權政策與權限說明 (Privacy)

在左側選單點擊 **「隱私權規範」（Privacy practices）**（此步為 Google 安全審查核心，已對應 v1.0.1 實際權限與 `world: "MAIN"` 邊界）：

#### 1. 單一用途說明 (Single purpose)
- 複製貼上：
  ```text
  Automates MCP (Model Context Protocol) tool permission approvals, continuation confirmation chips, per-conversation controls with isolated emergency stops, and stall auto-recovery exclusively on the Google Gemini web application.
  ```

#### 2. 權限理由 (Permission justifications)
打開 `store-submission/06-privacy-and-permissions/PERMISSIONS_JUSTIFICATIONS_FOR_REVIEWER.txt`，對應貼上：
- **Host permissions (`https://gemini.google.com/*`)**：
  `The extension exclusively interacts with Google Gemini (https://gemini.google.com/*) to detect MCP approval dialogs, click confirmation chips, enforce per-conversation toggles and isolated emergency stops, and render an on-page draggable status HUD. The extension requests no access to any other website or domain.`
- **`storage`**：
  `Required to persist global user preferences (cooldown intervals, breaker thresholds, HUD position coordinates, theme/language, and custom keyword lists), daily local click counters, and per-conversation override settings / isolated emergency-stop flags (gmah_chat_overrides_v1) locally on the device via chrome.storage.local.`
- **`tabs`**：
  `Required to identify active Google Gemini tabs and their conversation path for per-chat control matching in the popup and background service worker, toggle autoDiscardable per active background-enabled Gemini tab to prevent premature tab discarding, and bring the corresponding Gemini tab into focus when the user clicks a desktop stall or circuit-breaker alert.`
- **`alarms`**：
  `Required to maintain periodic keepalive heartbeats and minimized-window follow-up wakeups in the Manifest V3 service worker so that automated background tasks do not stall or terminate prematurely when the browser window is minimized or inactive.`
- **`scripting`**：
  `Required to (1) dynamically inject bundled content scripts into already-opened https://gemini.google.com/* tabs upon extension install or update without requiring a browser restart, and (2) execute a strictly local, self-contained world: "MAIN" helper (mainWorldClickByToken and a lightweight renderer wake ping) exclusively on Gemini tabs when background or minimized tab throttling blocks isolated-world clicks on Shadow DOM or Angular Material confirmation chips. No remote code is fetched or executed, and no arbitrary page data is extracted.`
- **`notifications`**：
  `Required solely to display native desktop alert notifications when an MCP tool execution or Gemini text generation hangs/stalls longer than the user-configured timeout threshold (default 5 minutes) or when a safety circuit breaker trips, allowing the user to click the alert and jump straight back to the corresponding Gemini tab.`

#### 3. 資料收集聲明 (Data usage)
- 選擇：**「我不收集或使用任何資料」（I am not collecting or using data）**。
- **隱私權政策網址 (Privacy policy URL)**：
  `https://github.com/ngiken/KenEasy-Gemini-MCP-Auto-Helper/blob/main/PRIVACY.md`
- 底部 3 項承諾全部勾選：
  ☑ 承諾不收集或使用資料
  ☑ 承諾不出售資料
  ☑ 承諾不用於與核心功能無關之用途

---

### 步驟 4：定價與散布設定 (Distribution)

在左側選單點擊 **「散布」（Distribution）**：
1. **公開範圍 (Visibility)**：選擇 **「公開」（Public）**。
2. **定價 (Pricing)**：選擇 **「免費」（Free）**。
3. **地區 (Regions)**：選擇 **「所有地區」（All regions）**。

---

### 步驟 5：提交審查 (Submit for Review)
1. 檢查頁面右上角，確保所有必填標籤頁均顯示為綠色打勾狀態。
2. 點擊右上角的藍色按鈕 **「提交審查」（Submit for review）**。
3. 在確認彈窗中點擊確認。通常會在 **24 至 48 小時內** 審核通過並自動在全球 Chrome Web Store 上線！
