# 🗺️ Android Fake GPS 控制台

![Node.js](https://img.shields.io/badge/Node.js-14%2B-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)
![Platform](https://img.shields.io/badge/Platform-Android-3DDC84?logo=android&logoColor=white)

一個基於 Node.js 的本地網頁工具，透過 ADB 將虛擬 GPS 座標發送到 Android 手機的 Appium Settings。支援 Google Maps（需 API Key）或 OpenStreetMap（免費，無需任何 Key）雙地圖系統、路徑規劃播放、GPS 鎖定與最愛地點管理。

> **⚠️ 免責聲明**：本工具僅供個人開發測試使用。在遊戲或應用程式中使用假 GPS 可能違反服務條款，使用者需自行承擔風險。

---

## 💖 贊助

如果這個工具對你有幫助，歡迎請我喝杯咖啡 ☕

<a href='https://ko-fi.com/I3I41GR33G' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi6.png?v=6' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>
&nbsp;&nbsp;
<a href='https://core.newebpay.com/EPG/comment_helper/t9gZwO' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://www.newebpay.com/ud/img/logo_sm2.png' border='0' alt='藍新金流贊助' /></a>

---

## 📚 文件

| 文件 | 適合對象 |
|------|---------|
| **本頁（README）** | 功能概覽與技術參考 |
| [⚡ 快速安裝（quickinstall.md）](quickinstall.md) | 熟悉 CLI 的開發者，快速上手 |
| [📖 完全新手教學（tutor.md）](tutor.md) | 沒有程式經驗的使用者，從零到完成 |

---

## ✨ 功能特色

- 🗺️ **雙地圖系統** — 輸入 Google Maps API Key 使用 Google Maps；留空自動切換為 OpenStreetMap（完全免費）
- 🔍 **地點搜尋** — Google Maps 模式使用 Places Autocomplete；OpenStreetMap 模式使用 Nominatim
- 👁️ **預覽確認流程** — 搜尋、點地圖、手動輸入皆先顯示黃色預覽標記，按「✓ 改變定位」才真正送出
- ↩ **快速回位** — 圓形按鈕一鍵將地圖視角拉回目前確認的 GPS 位置
- 🕹️ **八方向 D-Pad** — 含斜向的精細微調，按住持續移動（支援觸控），立即送出無需確認
- 🔒 **GPS 鎖定（Keepalive）** — 座標送出後伺服器每 2 秒自動重送，防止手機 GPS 回到真實位置
- 🛤️ **路徑規劃** — 以目前位置為起點，設定 1 個以上航點即可播放；可調速度（1–50 km/h）
- 🎲 **反偵測隨機性** — 播放時自動加入速度波動 ±25%、GPS 抖動 ±2m、間隔波動 ±20%
- ⭐ **最愛地點 & 路徑** — 儲存常用地點與路徑，一鍵快速載入
- 📜 **位置歷史** — 自動記錄最近 10 筆確認位置，點擊可載入為預覽
- 💾 **狀態持久化** — 所有設定自動儲存至 localStorage，重新整理頁面後完整恢復
- 📡 **ADB 裝置自動偵測** — 自動偵測 Android SDK 版本，選用正確的 ADB 指令

---

## 系統需求

| 項目 | 需求 |
|------|------|
| Node.js | 14.0 以上 |
| ADB (Android Debug Bridge) | 任意版本 |
| Android 手機 | Android 8.0 以上（建議 10+）|
| Google Maps API Key | 選用；啟用 Maps JavaScript API 與 Places API（留空則使用免費 OpenStreetMap）|

---

## 🚀 安裝與啟動

### 1. 下載專案

```bash
git clone git@github.com:gg90052/fakeGPS.git
cd fakeGPS
```

### 2. 安裝依賴

```bash
npm install
```

### 3. 啟動伺服器

```bash
npm start
```

### 4. 開啟瀏覽器

前往 [http://localhost:3000](http://localhost:3000)

---

## 🗺️ Google Maps API Key（選用）

開啟後，側邊欄最上方有「**Google Maps API Key**」輸入框：

- **留空**：使用 OpenStreetMap（免費，無需帳號）
- **填入 Key**：切換為 Google Maps，支援 Places Autocomplete 搜尋

> **如何取得 API Key：**
> 1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
> 2. 建立或選擇一個專案
> 3. 啟用 **Maps JavaScript API** 與 **Places API**
> 4. 前往「憑證」→「建立憑證」→「API 金鑰」
> 5. 建議設定 HTTP 參照網址限制（`http://localhost:3000/*`）

Key 儲存於 localStorage，重新整理後自動套用。點「**清除**」可隨時切回 OpenStreetMap。

---

## 📱 Android 手機設定

### 步驟一：啟用開發者選項

1. 前往 **設定 → 關於手機**
2. 連續點擊「**版本號碼**」7 次
3. 回到設定，即可看到「**開發者選項**」

### 步驟二：開啟 USB 偵錯

進入「**開發者選項**」→ 開啟「**USB 偵錯**」

### 步驟三：安裝 ADB

**macOS（推薦）：**
```bash
brew install android-platform-tools
```

**Windows：**
下載 [Android SDK Platform Tools](https://developer.android.com/studio/releases/platform-tools)，解壓縮後將目錄加入 PATH。

**Linux（Ubuntu/Debian）：**
```bash
sudo apt install adb
```

**驗證安裝：**
```bash
adb version
# Android Debug Bridge version x.x.x
```

### 步驟四：連接手機並安裝 Appium Settings

透過 USB 連接手機，在電腦端執行：

```bash
# 確認裝置已連線
adb devices
# 應顯示：xxxxxxxxxxxx  device

# 安裝 Appium Settings（已包含在專案根目錄）
adb install appium-settings.apk
```

> **Appium Settings 說明：** 本 APK 來自開源專案 [Appium Settings](https://github.com/appium/io.appium.settings)，如需自行取得最新版，可前往該專案的 [Releases 頁面](https://github.com/appium/io.appium.settings/releases)下載。

### 步驟五：設定模擬位置應用程式

1. 進入「**開發者選項**」
2. 找到「**選取模擬位置應用程式**」
3. 選擇 **Appium Settings**

> **注意**：伺服器啟動後會自動偵測 Android SDK 版本，並在 Android 8+（API 26+）自動使用 `start-foreground-service`，無需手動修改設定。

---

## 📖 使用說明

### 位置設定（預覽確認流程）

所有輸入方式皆採「預覽 → 確認」兩步驟：

1. **搜尋地名**（輸入後按 Enter）、**點擊地圖**或**手動輸入座標** → 黃色預覽標記出現
2. 確認位置後按「**✓ 改變定位**」→ 座標送出，紅色主標記移動
3. 按「**↩**」（圓形按鈕）可隨時將地圖視角拉回紅色標記位置

> **D-Pad 方向鍵**為立即模式，不需預覽確認，直接送出。

### GPS 鎖定（Keepalive）

座標送出後，伺服器會自動每 2 秒重送相同座標，防止手機 GPS 漂移回真實位置。

- 側邊欄顯示 **🔒 GPS 鎖定中** 表示鎖定中
- 點「**暫停鎖定**」可暫時停止重送；點「**恢復鎖定**」重新啟動

### D-Pad 微調

- 設定「**微調距離**」（預設 10 公尺）
- **點擊**：移動一格，立即送出
- **按住**：持續移動（每 150ms 一次）
- **中心 ●**：重新送出當前座標（不移動）

### 路徑規劃與播放

1. 點「**開啟航點模式**」
2. 在地圖上點擊新增航點（**至少 1 個**，路徑自動從目前確認位置出發）
3. 調整速度滑桿（1–50 km/h）
4. 點「**▶ 開始播放**」，地圖上會顯示藍色路線與移動的標記
5. 點「**■ 停止**」隨時中止

> 若第一個航點與目前位置距離超過 **20 km**，播放前會彈出確認視窗。

### 最愛與歷史

- **最愛地點**：按「**★ 加入最愛地點**」儲存當前座標；點「📍」載入為預覽
- **最愛路徑**：設定好航點後按「**★ 儲存路徑**」；點「▶」快速載入
- **歷史記錄**：每次確認定位自動記錄（最多 10 筆），點「📍」載入為預覽

---

## 🔧 技術細節

### 架構

```
瀏覽器（前端）
    │  Google Maps JavaScript API / Leaflet.js + OpenStreetMap
    │  Nominatim（OpenStreetMap 地點搜尋）
    ▼
Express 伺服器（Node.js）
    │  child_process.exec
    │  GPS Keepalive（每 2 秒重送最後座標）
    ▼
ADB (Android Debug Bridge)
    │  am startservice / am start-foreground-service（依 Android 版本自動選擇）
    ▼
Android 手機
    └─ Appium Settings LocationService
```

### 播放隨機性（反偵測）

| 機制 | 數值 |
|------|------|
| 速度波動 | ±25% |
| GPS 抖動 | ±2 公尺 |
| Tick 間隔波動 | ±20% |
| 基礎更新頻率 | 500ms |

使用遞迴 `setTimeout`（非 `setInterval`）實現不等間隔更新，模擬真實行走的不規律性。

### localStorage 資料結構

| Key | 內容 |
|-----|------|
| `fakegps_lat` / `fakegps_lng` | 最後確認座標 |
| `fakegps_zoom` | 地圖縮放等級 |
| `fakegps_speed` | 速度（km/h）|
| `fakegps_step` | 微調距離（公尺）|
| `fakegps_waypoints` | 航點陣列 |
| `fakegps_fav_locations` | 最愛地點清單 |
| `fakegps_fav_routes` | 最愛路徑清單 |
| `fakegps_history` | 位置歷史（最多 10 筆）|
| `fakegps_gmaps_key` | Google Maps API Key |

---

## ❓ 常見問題

**地圖無法顯示（ApiNotActivatedMapError）**
→ 請確認 Google Cloud Console 中已啟用「Maps JavaScript API」與「Places API」，並已設定帳單資訊。或清除 API Key 改用免費的 OpenStreetMap。

**GPS 設定後手機位置沒有變化**
→ 確認已在開發者選項中將「模擬位置應用程式」設定為 Appium Settings。

**ADB 找不到裝置（no devices found）**
→ 確認手機已開啟 USB 偵錯，USB 連接穩定，並已接受手機上的「允許 USB 偵錯」提示。

**座標送出後一段時間 GPS 又漂回真實位置**
→ 確認側邊欄顯示「🔒 GPS 鎖定中」。若顯示「⏸ 未鎖定」，點「恢復鎖定」重新啟動 keepalive。

---

## 🛠️ 技術棧

- **後端**：Node.js、Express 5
- **前端**：Vanilla JavaScript、Google Maps JavaScript API / Leaflet.js + OpenStreetMap
- **通訊**：ADB (Android Debug Bridge)
- **Android**：Appium Settings LocationService
- **UI 主題**：[Catppuccin Mocha](https://github.com/catppuccin/catppuccin)

---

## 📄 授權

本專案採用 [MIT License](LICENSE) 授權。

---
---

# 🗺️ Android Fake GPS Controller

![Node.js](https://img.shields.io/badge/Node.js-14%2B-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)
![Platform](https://img.shields.io/badge/Platform-Android-3DDC84?logo=android&logoColor=white)

A local web-based tool built with Node.js that sends fake GPS coordinates to an Android device via ADB and Appium Settings. Supports both Google Maps (API Key required) and OpenStreetMap (free, no key needed), with route planning, GPS keepalive, and favorites management.

> **⚠️ Disclaimer**: This tool is intended for personal development and testing only. Using fake GPS in games or apps may violate their Terms of Service. Use at your own risk.

---

## 💖 Support

If this tool has been helpful, feel free to buy me a coffee ☕

<a href='https://ko-fi.com/I3I41GR33G' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi6.png?v=6' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>
&nbsp;&nbsp;
<a href='https://core.newebpay.com/EPG/comment_helper/t9gZwO' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://www.newebpay.com/ud/img/logo_sm2.png' border='0' alt='Donate via NewebPay' /></a>

---

## 📚 Documentation

| Document | Best for |
|----------|---------|
| **This page (README)** | Feature overview & technical reference |
| [⚡ Quick Install (quickinstall.md)](quickinstall.md) | Developers familiar with CLI — get running fast |
| [📖 Full Beginner Guide (tutor.md)](tutor.md) | Users with no programming experience — zero to done |

---

## ✨ Features

- 🗺️ **Dual Map System** — Enter a Google Maps API Key to use Google Maps; leave blank to automatically use OpenStreetMap (completely free)
- 🔍 **Place Search** — Google Places Autocomplete in Google Maps mode; Nominatim in OpenStreetMap mode
- 👁️ **Preview-First Flow** — Search, map click, or manual input all show a yellow preview marker first; click "✓ Confirm Location" to actually send
- ↩ **Quick Return** — Circular button to instantly pan the map view back to the current confirmed GPS position
- 🕹️ **8-Direction D-Pad** — Fine-tune position including diagonals; hold to move continuously (touch-friendly), sent immediately without preview
- 🔒 **GPS Keepalive** — After sending coordinates, the server automatically resends them every 2 seconds to prevent GPS drift back to real location
- 🛤️ **Route Planning** — Starts from your current position; only 1 waypoint needed; adjustable speed (1–50 km/h)
- 🎲 **Anti-Detection Randomness** — Speed variance ±25%, GPS jitter ±2m, interval variance ±20% during playback
- ⭐ **Favorite Locations & Routes** — Save frequently used locations and routes for one-click loading
- 📜 **Location History** — Automatically records the last 10 confirmed positions; click to load as preview
- 💾 **State Persistence** — All settings automatically saved to localStorage and restored on page reload
- 📡 **Auto ADB Detection** — Automatically detects Android SDK version and selects the correct ADB command

---

## Requirements

| Item | Requirement |
|------|-------------|
| Node.js | 14.0 or higher |
| ADB (Android Debug Bridge) | Any version |
| Android device | Android 8.0+ (10+ recommended) |
| Google Maps API Key | Optional; Maps JavaScript API + Places API (leave blank to use free OpenStreetMap) |

---

## 🚀 Installation & Setup

### 1. Clone the repository

```bash
git clone git@github.com:gg90052/fakeGPS.git
cd fakeGPS
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the server

```bash
npm start
```

### 4. Open in browser

Navigate to [http://localhost:3000](http://localhost:3000)

---

## 🗺️ Google Maps API Key (Optional)

After opening the app, you'll find a **Google Maps API Key** input at the top of the sidebar:

- **Leave blank**: Uses OpenStreetMap (free, no account needed)
- **Enter a key**: Switches to Google Maps with Places Autocomplete

> **How to get an API Key:**
> 1. Go to [Google Cloud Console](https://console.cloud.google.com/)
> 2. Create or select a project
> 3. Enable **Maps JavaScript API** and **Places API**
> 4. Go to **Credentials** → **Create Credentials** → **API Key**
> 5. Recommended: restrict the key to `http://localhost:3000/*`

The key is saved to localStorage and automatically applied on reload. Click **Clear** to switch back to OpenStreetMap at any time.

---

## 📱 Android Device Setup

### Step 1: Enable Developer Options

1. Go to **Settings → About phone**
2. Tap **Build number** 7 times
3. Developer Options will appear in the Settings menu

### Step 2: Enable USB Debugging

Go to **Developer Options** → Enable **USB Debugging**

### Step 3: Install ADB

**macOS (recommended):**
```bash
brew install android-platform-tools
```

**Windows:**
Download [Android SDK Platform Tools](https://developer.android.com/studio/releases/platform-tools), extract, and add the directory to your PATH.

**Linux (Ubuntu/Debian):**
```bash
sudo apt install adb
```

**Verify installation:**
```bash
adb version
# Android Debug Bridge version x.x.x
```

### Step 4: Connect device and install Appium Settings

Connect your phone via USB, then run on your computer:

```bash
# Verify the device is recognized
adb devices
# Should show: xxxxxxxxxxxx  device

# Install Appium Settings (included in project root)
adb install appium-settings.apk
```

> **About Appium Settings:** This APK is from the open-source project [Appium Settings](https://github.com/appium/io.appium.settings). To get the latest version yourself, visit its [Releases page](https://github.com/appium/io.appium.settings/releases).

### Step 5: Set mock location app

1. Open **Developer Options**
2. Find **Select mock location app**
3. Select **Appium Settings**

> **Note**: The server automatically detects your Android SDK version and uses `start-foreground-service` on Android 8+ (API 26+). No manual configuration needed.

---

## 📖 Usage

### Setting a Location (Preview Flow)

All input methods use a two-step preview → confirm workflow:

1. **Search a place** (type + Enter), **click the map**, or **enter coordinates manually** → Yellow preview marker appears
2. Confirm the position by clicking **✓ Confirm Location** → Coordinates are sent, red marker moves
3. Click the **↩** circular button anytime to pan the map view back to the red confirmed marker

> **D-Pad directional buttons** use instant mode — coordinates are sent immediately without preview.

### GPS Keepalive

After sending coordinates, the server automatically resends them every 2 seconds to prevent GPS drift.

- Sidebar shows **🔒 GPS Locked** when active
- Click **Pause Lock** to stop resending; click **Resume Lock** to restart

### D-Pad Fine-Tuning

- Set the **Step Distance** (default: 10 meters)
- **Click**: Move one step, sent immediately
- **Hold**: Move continuously (every 150ms)
- **Center ●**: Resend the current coordinates without moving

### Route Planning & Playback

1. Click **Enable Waypoint Mode**
2. Click on the map to add waypoints (**minimum 1** — the route starts from your current confirmed position)
3. Adjust the speed slider (1–50 km/h)
4. Click **▶ Start Playback** — a blue route line and moving marker will appear
5. Click **■ Stop** to cancel at any time

> If the first waypoint is more than **20 km** from your current position, a confirmation dialog will appear before playback starts.

### Favorites & History

- **Favorite locations**: Click **★ Add to Favorites** to save the current coordinates; click 📍 to load as preview
- **Favorite routes**: After setting up waypoints, click **★ Save Route**; click ▶ to load instantly
- **History**: Every confirmed location is automatically recorded (up to 10 entries); click 📍 to load as preview

---

## 🔧 Technical Details

### Architecture

```
Browser (Frontend)
    │  Google Maps JavaScript API / Leaflet.js + OpenStreetMap
    │  Nominatim (OpenStreetMap place search)
    ▼
Express Server (Node.js)
    │  child_process.exec
    │  GPS Keepalive (resends last coordinates every 2s)
    ▼
ADB (Android Debug Bridge)
    │  am startservice / am start-foreground-service (auto-selected by Android version)
    ▼
Android Device
    └─ Appium Settings LocationService
```

### Anti-Detection Randomness

| Mechanism | Value |
|-----------|-------|
| Speed variance | ±25% |
| GPS jitter | ±2 meters |
| Tick interval variance | ±20% |
| Base update frequency | 500ms |

Uses recursive `setTimeout` (not `setInterval`) for variable-interval updates, simulating the irregular nature of real walking.

### localStorage Schema

| Key | Contents |
|-----|----------|
| `fakegps_lat` / `fakegps_lng` | Last confirmed coordinates |
| `fakegps_zoom` | Map zoom level |
| `fakegps_speed` | Speed (km/h) |
| `fakegps_step` | Step distance (meters) |
| `fakegps_waypoints` | Waypoints array |
| `fakegps_fav_locations` | Saved favorite locations |
| `fakegps_fav_routes` | Saved favorite routes |
| `fakegps_history` | Location history (up to 10 entries) |
| `fakegps_gmaps_key` | Google Maps API Key |

---

## ❓ FAQ

**Map doesn't load (ApiNotActivatedMapError)**
→ Make sure both **Maps JavaScript API** and **Places API** are enabled in Google Cloud Console with billing configured. Or clear the API Key to switch to the free OpenStreetMap.

**GPS doesn't update after setting coordinates**
→ Confirm that **Appium Settings** is selected as the mock location app in Developer Options.

**ADB can't find the device (no devices found)**
→ Verify USB Debugging is enabled, the USB connection is stable, and you've accepted the "Allow USB Debugging" prompt on your phone.

**GPS drifts back to real location after a while**
→ Check that the sidebar shows **🔒 GPS Locked**. If it shows **⏸ Unlocked**, click **Resume Lock** to restart the keepalive.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express 5
- **Frontend**: Vanilla JavaScript, Google Maps JavaScript API / Leaflet.js + OpenStreetMap
- **Communication**: ADB (Android Debug Bridge)
- **Android**: Appium Settings LocationService
- **UI Theme**: [Catppuccin Mocha](https://github.com/catppuccin/catppuccin)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
