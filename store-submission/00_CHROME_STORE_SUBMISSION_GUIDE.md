# Chrome Web Store 上架全流程手把手操作指引 (KenEasy Gemini MCP Auto Helper)

> 本文件為 **KenEasy Gemini MCP Auto Helper (v0.1 Beta)** 的 Chrome 官方商店上架一站式操作手冊。
> 本資料夾 `store-submission/` 內已分類準備好所有需上傳的軟體包、圖示、5 張高清宣傳截圖、2 張推薦橫幅、4 種語言文案與隱私權審查文件。
> 你只需打開 [Chrome Web Store 官方開發者控制台](https://chrome.google.com/webstore/devconsole)，按照下方步驟依序複製貼上即可！

---

## 📁 本資料夾結構與對應清單

```text
store-submission/
├── 00_CHROME_STORE_SUBMISSION_GUIDE.md    <-- 你正在閱讀的總操作指引
├── 01-package/
│   └── KenEasy-Gemini-MCP-Auto-Helper-store.zip   <-- [步驟 1] 需上傳的擴充功能壓縮包
├── 02-store-icon/
│   └── icon-128x128.png                           <-- [步驟 2] 商店圖示 (128x128 PNG)
├── 03-screenshots/                                <-- [步驟 2] 5 張官方規定 1280x800 截圖
│   ├── screenshot-1-mcp-auto-approval-1280x800.png
│   ├── screenshot-2-draggable-hud-1280x800.png
│   ├── screenshot-3-desktop-notifications-1280x800.png
│   ├── screenshot-4-popup-settings-1280x800.png
│   └── screenshot-5-circuit-breaker-protection-1280x800.png
├── 04-promotional-tiles/                          <-- [步驟 2] 推薦促銷橫幅
│   ├── small-promo-tile-440x280.png               <-- 小促銷圖 (440x280)
│   └── marquee-promo-tile-1400x560.png            <-- 大宣傳條幅 (1400x560)
├── 05-listing-texts/                              <-- [步驟 2] 多語言文字介紹 (直接複製)
│   ├── LISTING_zh_CN.txt                          <-- 簡體中文文案
│   ├── LISTING_zh_TW.txt                          <-- 繁體中文文案
│   ├── LISTING_en.txt                             <-- 英文文案 (預設語言)
│   └── LISTING_ja.txt                             <-- 日文文案
└── 06-privacy-and-permissions/                    <-- [步驟 3] 隱私政策與權限理由說明
    ├── PERMISSIONS_JUSTIFICATIONS_FOR_REVIEWER.txt<-- 審查員權限理由 (直接複製)
    ├── DATA_DISCLOSURE_DECLARATION.txt            <-- 數據收集聲明選項勾選指引
    └── PRIVACY_POLICY.md                          <-- 隱私政策全文
```

---

## 🚀 五步完成 Chrome 商店上架發布

### 步驟 1：登入並上傳軟體包 (Package)
1. 打開瀏覽器訪問：**[Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)**。
2. 點擊右上角或左上角的 **「新增項目」（New Item）** 按鈕。
3. 在彈出的上傳檔案視窗中，點擊上傳或直接將下方檔案拖入：
   - 檔案路徑：`store-submission/01-package/KenEasy-Gemini-MCP-Auto-Helper-store.zip`
4. 上傳完成後，系統會自動解壓並驗證 `manifest.json`，隨後自動跳轉至編輯頁面。

---

### 步驟 2：填寫商店資訊與圖片 (Store Listing)

在左側選單點擊 **「商店資訊」（Store listing）**：

#### 1. 基本資訊 (Basic details)
- **預設語言 (Default language)**：建議選擇 `English` 或 `Chinese (Simplified)`。
- **擴充功能名稱 (Name)** 與 **說明 (Summary & Description)**：
  - 打開 `store-submission/05-listing-texts/` 中對應語言的 `.txt` 檔案，將 **標題**、**132字簡短說明**、**詳細說明** 一鍵複製貼入相應欄位。
- **類別 (Category)**：選擇 **「生產力工具」（Productivity）** 或 **「開發者工具」（Developer Tools）**。

#### 2. 圖形資產 (Graphic assets)
- **商店圖示 (Store icon)**：
  - 上傳 `store-submission/02-store-icon/icon-128x128.png`。
- **螢幕截圖 (Screenshots - 需 1280x800)**：
  - 依序上傳 `store-submission/03-screenshots/` 資料夾內的 5 張截圖：
    1. `screenshot-1-mcp-auto-approval-1280x800.png`（MCP 自動放行）
    2. `screenshot-2-draggable-hud-1280x800.png`（全域自由拖拽懸浮窗）
    3. `screenshot-3-desktop-notifications-1280x800.png`（卡死超時桌面通知）
    4. `screenshot-4-popup-settings-1280x800.png`（全功能設定面板）
    5. `screenshot-5-circuit-breaker-protection-1280x800.png`（6 層防刷熔斷保護）
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

在左側選單點擊 **「隱私權規範」（Privacy practices）**（此步為 Google 安全審查核心，已為你準備好 100% 規範文案）：

#### 1. 單一用途說明 (Single purpose)
- 複製貼上：
  ```text
  Automates permission approval dialogs and continuation confirmation chips for MCP (Model Context Protocol) tools on Google Gemini web application, providing hands-free continuous AI interaction and multi-layer quota protection.
  ```

#### 2. 權限理由 (Permission justifications)
打開 `store-submission/06-privacy-and-permissions/PERMISSIONS_JUSTIFICATIONS_FOR_REVIEWER.txt`，對應貼上：
- **Host permissions (`https://gemini.google.com/*`)**：
  `The extension exclusively interacts with Google Gemini (https://gemini.google.com/*) to detect MCP approval dialogs, inspect tool confirmation buttons, and provide an on-page draggable status HUD. The extension requests no access to any other website or domain.`
- **`storage`**：
  `Required to persist user preferences (such as cooldown intervals, breaker thresholds, HUD position coordinates, and custom keyword lists) locally on the device using chrome.storage.local.`
- **`tabs`**：
  `Required to detect whether the user is currently viewing a Google Gemini tab, query tab status for the popup control panel, and bring the Gemini tab into focus when the user clicks a desktop stall alert notification.`
- **`alarms`**：
  `Required to maintain periodic keepalive heartbeats in the Manifest V3 service worker so that automated background tasks do not stall or terminate prematurely when the browser window is minimized or inactive.`
- **`scripting`**：
  `Required to dynamically inject content scripts into already-opened Google Gemini tabs when the extension is updated or reloaded by the user, avoiding the need for a full browser restart.`
- **`notifications`**：
  `Required solely to display native desktop alert notifications when an MCP tool execution or Gemini text generation hangs or stalls longer than the user-configured timeout threshold (default 5 minutes).`

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
