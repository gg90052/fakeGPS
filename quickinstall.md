# ⚡ 快速安裝指南 / Quick Install Guide

> **前置需求 / Prerequisites：** macOS、Xcode 15+、Node.js 14+、Python 3.13、iOS 17+ 裝置已開啟開發者模式

---

## 1. 下載並安裝 / Clone & Install

```bash
git clone git@github.com:gg90052/fakeGPS.git
cd fakeGPS
npm install
```

## 2. iOS 裝置設定 / iOS Device Setup

### 前置安裝（只需做一次）/ One-time installation

**macOS（推薦）：**

| 步驟 | 指令 / 說明 |
|------|------------|
| 1. 手機開啟開發者模式 | `設定 → 隱私權與安全性 → 開發者模式` → 開啟後重啟手機 |
| 2. 安裝 Xcode 15+ | 從 Mac App Store 安裝（約 7–14 GB） |
| 3. 安裝 Python 3.13（iOS 18.2+ 必須） | `brew install python@3.13` |
| 4. 在專案目錄建立 venv 並安裝 pymobiledevice3 | `python3.13 -m venv .venv` <br> `.venv/bin/pip install "pymobiledevice3>=9.6"` |

**Windows（額外需求，穩定性較低）：**

| 步驟 | 指令 / 說明 |
|------|------------|
| 1. 手機開啟開發者模式 | `設定 → 隱私權與安全性 → 開發者模式` → 開啟後重啟手機 |
| 2. 安裝 Python 3 | 至 python.org 下載，安裝時勾選「Add Python to PATH」|
| 3. 安裝 pymobiledevice3（需 9.6+） | `pip install "pymobiledevice3>=9.6"` |
| 4. 安裝 WireGuard（含 WinTun 驅動） | 至 wireguard.com/install 下載安裝 |

### 每次使用前的啟動順序 / Startup order

**macOS：**
```bash
# 步驟 A（首次或 USB 模式）：插上 iPhone USB，手機點「信任」
#          WiFi 模式：確認 iPhone 與 Mac 在同一個 WiFi，無需插線

# 步驟 B：啟動伺服器（會自動啟動 tunneld，需要 sudo 密碼）
npm start
# → tunneld 啟動後前端會自動偵測（約 15–30 秒）
```

**Windows（以系統管理員身份執行 PowerShell）：**
```powershell
# 步驟 A：插上 iPhone USB，手機點「信任」

# 步驟 B：啟動伺服器
npm start
# → 啟動器會自動執行 tunneld
```

確認裝置偵測成功（可選）：
```bash
# 開啟 http://localhost:3000 後，側邊欄裝置區塊會自動重試偵測（最多 60 秒）
# 成功時顯示：iPhone 名稱 + 連線方式（📶 WiFi 或 🔌 USB）
```

### iOS Troubleshooting

| 問題 / Problem | 解決方式 / Fix |
|------|----------|
| 裝置未偵測到 / Device not detected | 確認 tunneld 已執行；拔插 USB；手機點「信任」/ Confirm tunneld is running; re-plug USB; tap "Trust" on device |
| `QuicProtocolNotSupportedError`（iOS 18.2+） | 需要 Python 3.13：`brew install python@3.13`，然後在專案目錄重建 venv / Python 3.13 is required: `brew install python@3.13`, then recreate the venv |
| 等待 60 秒後仍未偵測到裝置 / No device detected after 60 sec | 確認 iPhone 與 Mac 在同一個 WiFi；或改用 USB 連線；tunneld 初次掃描約需 15–30 秒 / Confirm same WiFi; or switch to USB; initial scan ~15–30 sec |
| WiFi 連線後裝置消失 / Device disappears on WiFi | 確認手機螢幕未鎖定（部分情況鎖屏會斷開 mDNS）；或拔插 USB 重新信任 / Ensure phone not locked; or re-plug USB and tap "Trust" |
| 裝置選擇顯示「Channel is closed」/ Selector shows "Channel is closed" | DVT 通道中斷；重新啟動伺服器：Ctrl+C → `npm start` / DVT channel dropped; restart server |
| `pymobiledevice3: command not found` | 執行 `python3.13 -m venv .venv && .venv/bin/pip install "pymobiledevice3>=9.6"` |
| `xcode-select: error`（macOS） | 執行 `xcode-select --install` |
| tunneld 無法啟動（Windows） / tunneld won't start (Windows) | 確認已安裝 WireGuard；確認以系統管理員身份執行 PowerShell |
| GPS 不生效 / GPS has no effect | 確認 iPhone iOS 17+；確認 tunneld 仍在執行 |

---

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
| 選擇裝置 / Select device | 下拉選單選擇目標裝置 / Use the dropdown to pick the target device |
| 設定位置 / Set location | 搜尋 / 點地圖 / 輸入座標 → 黃色預覽標記 → **✓ 改變定位** |
| GPS 鎖定 / GPS Keepalive | 送出後自動啟用，顯示 🔒 / Auto-enabled after any location send — shows 🔒 in sidebar |
| 路徑播放 / Route playback | 開啟航點模式 → 新增 1+ 航點 → ▶ 開始播放 / Waypoint mode → add 1+ points → ▶ Start |
| 載入 GPX / Load GPX | 📂 載入 GPX → 選取 .gpx 檔案，自動填入航點並定位起點 / 📂 Load GPX → pick .gpx file, auto-populates waypoints and sends first point |
| 最愛 / Favorites | ★ 儲存；📍 / ▶ 載入 / ★ to save; 📍 / ▶ to load |
| 回到紅色標記 / Pan to red marker | ↩ 圓形按鈕 / ↩ circular button |

---

## 常見問題 / Troubleshooting

| 問題 / Problem | 解決方式 / Fix |
|---------|-----|
| 未偵測到裝置 / No device detected | 確認 tunneld 在執行、iPhone 已信任電腦 / Confirm tunneld is running and iPhone trusts the computer |
| GPS 漂回真實位置 / GPS drifts back | 確認側邊欄顯示 🔒；若無則點「恢復鎖定」/ Check sidebar shows 🔒; click "恢復鎖定" if needed |
| iOS 顯示 "Channel is closed" | 重新啟動伺服器（Ctrl+C → `npm start`）/ Restart the server (Ctrl+C → `npm start`) |
| iOS 18.2+ QUIC 錯誤 / iOS 18.2+ QUIC error | 需要 Python 3.13：`brew install python@3.13`，重建 venv / Python 3.13 required |

---
