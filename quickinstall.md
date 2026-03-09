# ⚡ 快速安裝指南 / Quick Install Guide

> **前置需求 / Prerequisites：** Node.js 14+、ADB 已安裝、Android 手機已開啟 USB 偵錯

---

## 1. 下載並安裝 / Clone & Install

```bash
git clone git@github.com:gg90052/fakeGPS.git
cd fakeGPS
npm install
```

## 2. 手機設定 / Phone Setup

```bash
# 確認手機已連線 / Verify ADB sees your phone
adb devices
# 應顯示 / Should show: XXXXXXXX  device

# 安裝 Appium Settings / Install Appium Settings
adb install appium-settings.apk
```

> APK 已包含於專案根目錄。如需自行取得最新版，請至 [Appium Settings Releases](https://github.com/appium/io.appium.settings/releases) 下載。

> ⚠️ **請勿直接開啟 Appium Settings App**（介面會閃退，正常現象）。請由手機設定授予位置權限：
> **設定 → 應用程式 → Appium Settings → 權限 → 位置 → 一律允許**
>
> ⚠️ **Do not open the Appium Settings app directly** (it will crash — this is expected). Grant location permission via phone settings instead:
> **Settings → Apps → Appium Settings → Permissions → Location → Allow all the time**

手機端：**開發者選項 → 選取模擬位置應用程式 → Appium Settings**

On your phone: **Developer Options → Select mock location app → Appium Settings**

## 3. 啟動 / Start

```bash
npm start
# 開啟瀏覽器 / Open http://localhost:3000
```

---

## 地圖選擇 / Map Provider

| 選項 / Option | 使用方式 / How |
|--------|-----|
| **OpenStreetMap**（免費）| 側邊欄 API Key 留空（預設）/ Leave API Key field blank (default) |
| **Google Maps** | 側邊欄貼上 API Key 並點套用 / Paste your API Key in the sidebar, click Apply |

---

## 功能速查 / Quick Feature Reference

| 功能 / Feature | 使用方式 / How to use |
|---------|-----------|
| 設定位置 / Set location | 搜尋 / 點地圖 / 輸入座標 → 黃色預覽標記 → **✓ 改變定位** |
| D-Pad 微調 / D-Pad nudge | 直接移動，無需確認 / Buttons move instantly (no confirm needed) |
| GPS 鎖定 / GPS Keepalive | 送出後自動啟用，顯示 🔒 / Auto-enabled after any location send — shows 🔒 in sidebar |
| 路徑播放 / Route playback | 開啟航點模式 → 新增 1+ 航點 → ▶ 開始播放 / Waypoint mode → add 1+ points → ▶ Start |
| 最愛 / Favorites | ★ 儲存；📍 / ▶ 載入 / ★ to save; 📍 / ▶ to load |
| 回到紅色標記 / Pan to red marker | ↩ 圓形按鈕 / ↩ circular button |

---

## 常見問題 / Troubleshooting

| 問題 / Problem | 解決方式 / Fix |
|---------|-----|
| 未偵測到裝置 / No device detected | 重新插拔 USB；確認手機點了「允許 USB 偵錯」/ Re-plug USB; accept "Allow USB Debugging" prompt |
| GPS 沒有改變 / GPS not changing | 開發者選項設定 Appium Settings 為模擬位置 App / Set **Appium Settings** as mock location app in Developer Options |
| GPS 漂回真實位置 / GPS drifts back | 確認側邊欄顯示 🔒；若無則點「恢復鎖定」/ Check sidebar shows 🔒; click "恢復鎖定" if needed |
| `adb` 找不到 / `adb` not found | 將 platform-tools 加入 PATH 後重開終端機 / Add platform-tools to PATH and reopen terminal |
| 地圖空白 / Map blank | 確認 API Key 正確，或清除改用免費 OpenStreetMap / Check API Key is valid, or clear it to use free OpenStreetMap |

---

> 📖 **完全沒有程式經驗？** 請看完整新手教學：[tutor.md](tutor.md)
>
> 📖 **New to this?** See the full beginner guide: [tutor.md](tutor.md)
