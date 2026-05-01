# 🗺️ pikGPS 控制台

![Node.js](https://img.shields.io/badge/Node.js-14%2B-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)
![iOS](https://img.shields.io/badge/iOS-17%2B-000000?logo=apple&logoColor=white)

一個基於 Node.js 的本地網頁工具，透過 pymobiledevice3 DVT LocationSimulation 將虛擬 GPS 座標發送到 iOS 裝置。支援 Google Maps（需 API Key）或 OpenStreetMap（免費，無需任何 Key）雙地圖系統、路徑規劃播放、GPS 鎖定與最愛地點管理。

> **⚠️ 免責聲明**：本工具僅供個人開發測試使用。在遊戲或應用程式中使用假 GPS 可能違反服務條款，使用者需自行承擔風險。

---

## 💖 贊助

如果這個工具對你有幫助，歡迎請我喝杯咖啡 ☕

<a href='https://ko-fi.com/I3I41GR33G' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi6.png?v=6' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>
<br />
藍新可支援超商小額付費
<a href='https://core.newebpay.com/EPG/comment_helper/t9gZwO' target='_blank'><img height='100' style='border:0px;height:100px;' src='https://ez2.app/wp-content/uploads/2025/03/spgateway_logo.png' border='0' alt='藍新金流' /></a>

---

## 📚 文件

| 文件                                              | 適合對象                         |
| ------------------------------------------------- | -------------------------------- |
| **本頁（README）**                                | 功能概覽與技術參考               |
| [⚡ 快速安裝（quickinstall.md）](quickinstall.md) | 熟悉 CLI 的開發者，快速上手      |
| [📖 完全新手教學（tutor.md）](tutor.md)           | 沒有程式經驗的使用者，從零到完成 |

---

## ✨ 功能特色

- 🗺️ **雙地圖系統** — 輸入 Google Maps API Key 使用 Google Maps；留空自動切換為 OpenStreetMap（完全免費）
- 🔍 **地點搜尋** — Google Maps 模式使用 Places Autocomplete；OpenStreetMap 模式使用 Nominatim
- 👁️ **預覽確認流程** — 搜尋、點地圖、手動輸入皆先顯示黃色預覽標記，按「✓ 改變定位」才真正送出
- ↩ **快速回位** — 圓形按鈕一鍵將地圖視角拉回目前確認的 GPS 位置
- 🔒 **GPS 鎖定（Keepalive）** — 座標送出後伺服器每 2 秒自動重送，防止手機 GPS 回到真實位置
- 🛤️ **路徑規劃** — 以目前位置為起點，設定 1 個以上航點即可播放；可調速度（1–50 km/h）
- 📂 **GPX 載入** — 直接載入 GPX 檔案自動填入航點，超過 300 點自動均勻取樣；載入後自動定位至起點並送出
- 🎲 **反偵測隨機性** — 播放時自動加入速度波動 ±25%、GPS 抖動 ±2m、間隔波動 ±20%
- ⭐ **最愛地點 & 路徑** — 儲存常用地點與路徑，一鍵快速載入
- 📜 **位置歷史** — 自動記錄最近 10 筆確認位置，點擊可載入為預覽
- 💾 **狀態持久化** — 所有設定自動儲存至 localStorage，重新整理頁面後完整恢復
- 📶 **iOS WiFi 連線** — 首次透過 USB 配對後，後續可直接以 WiFi 連線，無需插線
- 📡 **裝置自動偵測** — 自動偵測所有 iOS 裝置，以下拉選單呈現；裝置連線中時，前端每 3 秒自動重試（最多 60 秒）並顯示連線方式（USB / WiFi）與 DVT 狀態
- ⚠️ **iOS 錯誤提示** — DVT 通道異常斷線（Channel is closed）時，裝置選擇區塊會顯示紅色錯誤提示，引導使用者重啟伺服器

---

## 系統需求

| 項目              | 需求                                                                         |
| ----------------- | ---------------------------------------------------------------------------- |
| Node.js           | 14.0 以上                                                                    |
| macOS             | 推薦（Windows 穩定性較低）                                                   |
| Xcode             | 15+                                                                          |
| Python 3.13       | iOS 18.2+ TCP 模式必須                                                       |
| pymobiledevice3   | 9.6 以上（建議透過 .venv 安裝）                                              |
| iOS 裝置          | iOS 17 以上                                                                  |
| Google Maps API Key | 選用；啟用 Maps JavaScript API 與 Places API（留空則使用免費 OpenStreetMap） |

### 前置安裝

**macOS（推薦）：**

1. 手機開啟開發者模式：`設定 → 隱私權與安全性 → 開發者模式`
2. 電腦安裝 Xcode 15+（pymobiledevice3 依賴其底層框架）
3. 安裝 Python 3.13（iOS 18.2+ 必須）：
   ```bash
   brew install python@3.13
   ```
4. 在專案目錄建立 venv 並安裝 pymobiledevice3：
   ```bash
   python3.13 -m venv .venv
   .venv/bin/pip install "pymobiledevice3>=9.6"
   ```
5. 手機透過 USB 連接，在 iPhone 點「信任」
6. 執行 `npm start`，啟動器會自動啟動 tunneld；支援 USB 及 WiFi 連線（WiFi 需先透過 USB 完成配對）

**Windows（進階，穩定性較低）：**

1. 手機開啟開發者模式：`設定 → 隱私權與安全性 → 開發者模式`
2. 安裝 Python 3（[python.org](https://www.python.org)，安裝時勾選「Add Python to PATH」）
3. 安裝 pymobiledevice3（需 9.6 以上）：
   ```powershell
   pip install "pymobiledevice3>=9.6"
   ```
4. 安裝 [WireGuard for Windows](https://www.wireguard.com/install/)（包含 tunneld 所需的 WinTun 驅動）
5. 以**系統管理員**身份開啟 PowerShell，手機連接 USB 並信任電腦
6. 執行 `npm start`，啟動器會自動啟動 tunnel 並開啟伺服器

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
>
> 1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
> 2. 建立或選擇一個專案
> 3. 啟用 **Maps JavaScript API** 與 **Places API**
> 4. 前往「憑證」→「建立憑證」→「API 金鑰」
> 5. 建議設定 HTTP 參照網址限制（`http://localhost:3000/*`）

Key 儲存於 localStorage，重新整理後自動套用。點「**清除**」可隨時切回 OpenStreetMap。

---

## 📖 使用說明

### 位置設定（預覽確認流程）

所有輸入方式皆採「預覽 → 確認」兩步驟：

1. **搜尋地名**（輸入後按 Enter）、**點擊地圖**或**手動輸入座標** → 黃色預覽標記出現
2. 確認位置後按「**✓ 改變定位**」 → 座標送出，紅色主標記移動
3. 按「**↩**」（圓形按鈕）可隨時將地圖視角拉回紅色標記位置

### GPS 鎖定（Keepalive）

座標送出後，伺服器會自動每 2 秒重送相同座標，防止手機 GPS 漂移回真實位置。

- 側邊欄顯示 **🔒 GPS 鎖定中** 表示鎖定中
- 點「**暫停鎖定**」可暫時停止重送；點「**恢復鎖定**」重新啟動

### 路徑規劃與播放

1. 點「**開啟航點模式**」，在地圖上點擊新增航點（**至少 1 個**，路徑自動從目前確認位置出發）
   - 或點「**📂 載入 GPX**」選取 GPX 檔案，自動填入所有航點並定位至起點
2. 調整速度滑桿（1–50 km/h）
3. 點「**▶ 開始播放**」，地圖上會顯示藍色路線與移動的標記
4. 點「**■ 停止**」隨時中止

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
    │  child_process.spawn
    │  GPS Keepalive（每 2 秒重送最後座標）
    ▼
pymobiledevice3 tunneld
    │  iOS DVT LocationSimulation
    │  USB 或 WiFi 連線
    ▼
iOS 裝置
    └─ ios_location_daemon.py（DVT）
```

### 播放隨機性（反偵測）

| 機制          | 數值    |
| ------------- | ------- |
| 速度波動      | ±25%    |
| GPS 抖動      | ±2 公尺 |
| Tick 間隔波動 | ±20%    |
| 基礎更新頻率  | 500ms   |

使用遞迴 `setTimeout`（非 `setInterval`）實現不等間隔更新，模擬真實行走的不規律性。

### localStorage 資料結構

| Key                           | 內容                   |
| ----------------------------- | ---------------------- |
| `fakegps_lat` / `fakegps_lng` | 最後確認座標           |
| `fakegps_zoom`                | 地圖縮放等級           |
| `fakegps_speed`               | 速度（km/h）           |
| `fakegps_waypoints`           | 航點陣列               |
| `fakegps_fav_locations`       | 最愛地點清單           |
| `fakegps_fav_routes`          | 最愛路徑清單           |
| `fakegps_history`             | 位置歷史（最多 10 筆） |
| `fakegps_gmaps_key`           | Google Maps API Key    |

---

## ❓ 常見問題

**地圖無法顯示（ApiNotActivatedMapError）**
→ 請確認 Google Cloud Console 中已啟用「Maps JavaScript API」與「Places API」，並已設定帳單資訊。或清除 API Key 改用免費的 OpenStreetMap。

**座標送出後一段時間 GPS 又漂回真實位置**
→ 確認側邊欄顯示「🔒 GPS 鎖定中」。若顯示「⏸ 未鎖定」，點「恢復鎖定」重新啟動 keepalive。

**iOS 裝置顯示「等待裝置連線…」超過 60 秒**
→ 確認 iPhone 與 Mac 在同一個 WiFi 網路，或改用 USB 連線；tunneld 啟動後約需 15–30 秒掃描到裝置，前端會自動重試。

**iOS 18.2+ QUIC 錯誤 / QuicProtocolNotSupportedError**
→ 需要 Python 3.13 並使用本專案的 .venv。執行 `brew install python@3.13`，再於專案目錄執行：
```bash
python3.13 -m venv .venv
.venv/bin/pip install "pymobiledevice3>=9.6"
```

**iOS 顯示「Channel is closed」**
→ DVT 通道中斷，重啟伺服器即可（Ctrl+C → `npm start`）。

---

## 🛠️ 技術棧

- **後端**：Node.js + Express 5
- **iOS 連線**：pymobiledevice3 9.6+（DVT LocationSimulation + tunneld）
- **前端**：原生 JavaScript + Leaflet.js / Google Maps JavaScript API
- **地圖搜尋**：Nominatim（OpenStreetMap）/ Places Autocomplete（Google Maps）

---

## 📄 授權

MIT License

---

# 🗺️ pikGPS Controller

![Node.js](https://img.shields.io/badge/Node.js-14%2B-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)
![iOS](https://img.shields.io/badge/iOS-17%2B-000000?logo=apple&logoColor=white)

A local Node.js web tool that uses pymobiledevice3 DVT LocationSimulation to send fake GPS coordinates to iOS devices. Supports Google Maps (requires API key) or OpenStreetMap (free, no key required), route planning playback, GPS keepalive, and favorites management.

> **⚠️ Disclaimer:** This tool is for personal development and testing only. Using fake GPS in games or apps may violate their terms of service — use at your own risk.

---

## 💖 Support

If this tool helped you, consider buying me a coffee ☕

<a href='https://ko-fi.com/I3I41GR33G' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi6.png?v=6' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>

---

## 📚 Documentation

| Document                                          | Audience                                   |
| ------------------------------------------------- | ------------------------------------------ |
| **This page (README)**                            | Feature overview and technical reference   |
| [⚡ Quick Install (quickinstall.md)](quickinstall.md) | Developers familiar with CLI               |
| [📖 Beginner Tutorial (tutor.md)](tutor.md)       | Users without programming experience       |

---

## ✨ Features

- 🗺️ **Dual map system** — Use Google Maps with an API key, or fall back to free OpenStreetMap
- 🔍 **Location search** — Places Autocomplete (Google Maps) / Nominatim (OpenStreetMap)
- 👁️ **Preview-then-confirm flow** — Search, click, or type coords first show a yellow preview marker; click "✓ Confirm" to actually send
- ↩ **Quick recenter** — Round button to recenter the map on the last confirmed GPS position
- 🔒 **GPS Keepalive** — Server resends the latest coordinate every 2 seconds to prevent drift
- 🛤️ **Route planning** — Set 1+ waypoints and play; speed adjustable (1–50 km/h)
- 📂 **GPX loading** — Load GPX files to auto-populate waypoints (down-sampled to 300 points if larger); first point is sent immediately
- 🎲 **Anti-detection randomness** — Speed jitter ±25%, GPS jitter ±2m, interval jitter ±20%
- ⭐ **Favorites** — Save locations and routes for quick recall
- 📜 **History** — Last 10 confirmed positions, click to load as preview
- 💾 **Persistence** — All settings saved to localStorage
- 📶 **iOS WiFi connection** — After initial USB pairing, connect over WiFi without a cable
- 📡 **Auto device detection** — All iOS devices auto-detected; sidebar retries up to 60 sec; shows USB/WiFi and DVT status
- ⚠️ **iOS error feedback** — Shows red banner when DVT channel drops, prompting server restart

---

## Requirements

| Item                  | Requirement                                                  |
| --------------------- | ------------------------------------------------------------ |
| Node.js               | 14.0+                                                        |
| macOS                 | Recommended (Windows is less stable)                         |
| Xcode                 | 15+                                                          |
| Python 3.13           | Required for iOS 18.2+ TCP mode                              |
| pymobiledevice3       | 9.6+ (recommended via .venv)                                 |
| iOS device            | iOS 17+                                                      |
| Google Maps API Key   | Optional; enable Maps JavaScript API and Places API          |

### One-time setup

**macOS (recommended):**

1. Enable Developer Mode on phone: `Settings → Privacy & Security → Developer Mode`
2. Install Xcode 15+ from App Store (pymobiledevice3 depends on its frameworks)
3. Install Python 3.13 (required for iOS 18.2+):
   ```bash
   brew install python@3.13
   ```
4. Create venv and install pymobiledevice3 in the project directory:
   ```bash
   python3.13 -m venv .venv
   .venv/bin/pip install "pymobiledevice3>=9.6"
   ```
5. Connect iPhone via USB and tap "Trust"
6. Run `npm start` — the launcher auto-starts tunneld. Supports both USB and WiFi (WiFi requires initial USB pairing)

**Windows (advanced, less stable):**

1. Enable Developer Mode on phone
2. Install Python 3 from [python.org](https://www.python.org) (check "Add Python to PATH")
3. Install pymobiledevice3 (9.6+ required):
   ```powershell
   pip install "pymobiledevice3>=9.6"
   ```
4. Install [WireGuard for Windows](https://www.wireguard.com/install/) (provides the WinTun driver tunneld needs)
5. Open PowerShell as **Administrator**, connect iPhone via USB and trust
6. Run `npm start` — the launcher auto-starts tunnel and the server

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

Visit [http://localhost:3000](http://localhost:3000)

---

## 🗺️ Google Maps API Key (Optional)

The "**Google Maps API Key**" input is at the top of the sidebar:

- **Empty**: Uses OpenStreetMap (free, no account)
- **With key**: Switches to Google Maps with Places Autocomplete

> **How to get an API key:**
>
> 1. Visit [Google Cloud Console](https://console.cloud.google.com/)
> 2. Create or select a project
> 3. Enable **Maps JavaScript API** and **Places API**
> 4. Credentials → Create credentials → API key
> 5. (Recommended) restrict to `http://localhost:3000/*`

The key is stored in localStorage and applied on reload. Click "**Clear**" to switch back to OpenStreetMap anytime.

---

## 📖 Usage

### Setting a Location (Preview Flow)

All input methods follow a "preview → confirm" two-step:

1. **Search**, **click on map**, or **type coords** → yellow preview marker appears
2. Verify, then click "**✓ Confirm Location**" → coords sent, red main marker moves
3. Click "**↩**" anytime to recenter on the red marker

### GPS Keepalive

After sending coords, the server resends them every 2 seconds to prevent the phone GPS from drifting back.

- Sidebar shows **🔒 GPS Locked** when active
- Click "**Pause Lock**" to stop, "**Resume Lock**" to restart

### Route Planning & Playback

1. Click "**Enable Waypoint Mode**" and tap on map to add waypoints (**1+ minimum**, route starts from current confirmed location)
   - Or click "**📂 Load GPX**" to load a GPX file (auto-populates all waypoints and sends the first one)
2. Adjust speed slider (1–50 km/h)
3. Click "**▶ Start Playback**" — blue line and moving marker appear
4. Click "**■ Stop**" anytime

> If the first waypoint is more than 20 km away, a confirmation dialog appears.

### Favorites & History

- **Favorite Locations**: "**★ Add to Favorites**" saves current coords; "📍" loads as preview
- **Favorite Routes**: After setting waypoints, "**★ Save Route**"; "▶" reloads
- **History**: Auto-records last 10 confirmed locations; "📍" reloads as preview

---

## 🔧 Technical Details

### Architecture

```
Browser (frontend)
    │  Google Maps JS API / Leaflet.js + OpenStreetMap
    │  Nominatim (OpenStreetMap geocoding)
    ▼
Express server (Node.js)
    │  child_process.spawn
    │  GPS Keepalive (resends last coord every 2 s)
    ▼
pymobiledevice3 tunneld
    │  iOS DVT LocationSimulation
    │  USB or WiFi
    ▼
iOS device
    └─ ios_location_daemon.py (DVT)
```

### Anti-Detection Randomness

| Mechanism        | Value     |
| ---------------- | --------- |
| Speed jitter     | ±25%      |
| GPS jitter       | ±2 meters |
| Tick interval    | ±20%      |
| Base update rate | 500 ms    |

Uses recursive `setTimeout` (not `setInterval`) for irregular intervals — mimics real walking.

### localStorage Schema

| Key                           | Content                |
| ----------------------------- | ---------------------- |
| `fakegps_lat` / `fakegps_lng` | Last confirmed coords  |
| `fakegps_zoom`                | Map zoom level         |
| `fakegps_speed`               | Speed (km/h)           |
| `fakegps_waypoints`           | Waypoint array         |
| `fakegps_fav_locations`       | Favorite locations     |
| `fakegps_fav_routes`          | Favorite routes        |
| `fakegps_history`             | Location history (10)  |
| `fakegps_gmaps_key`           | Google Maps API key    |

---

## ❓ FAQ

**Map not loading (ApiNotActivatedMapError)**
→ Confirm "Maps JavaScript API" and "Places API" are enabled in Google Cloud Console and billing is set up. Or clear the API key to use the free OpenStreetMap.

**GPS drifts back after a while**
→ Check sidebar shows "🔒 GPS Locked". If "⏸ Unlocked", click "Resume Lock" to restart keepalive.

**iOS device shows "Waiting for device…" for over 60 seconds**
→ Confirm iPhone and Mac are on the same WiFi, or use USB; tunneld takes ~15–30 sec for initial scan, frontend auto-retries.

**iOS 18.2+ QUIC error / QuicProtocolNotSupportedError**
→ Python 3.13 + project .venv required:
```bash
brew install python@3.13
python3.13 -m venv .venv
.venv/bin/pip install "pymobiledevice3>=9.6"
```

**iOS shows "Channel is closed"**
→ DVT channel dropped; restart the server (Ctrl+C → `npm start`).

---

## 🛠️ Tech Stack

- **Backend:** Node.js + Express 5
- **iOS connectivity:** pymobiledevice3 9.6+ (DVT LocationSimulation + tunneld)
- **Frontend:** Vanilla JavaScript + Leaflet.js / Google Maps JS API
- **Geocoding:** Nominatim (OpenStreetMap) / Places Autocomplete (Google Maps)

---

## 📄 License

MIT License
