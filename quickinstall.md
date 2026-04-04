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

## 📱 iOS 裝置設定（iOS 17+，選用）

> Android 使用者可跳過。目前僅支援 Mac 電腦。

### 前置安裝（只需做一次）

**macOS：**

| 步驟 | 指令 / 說明 |
|------|------------|
| 1. 手機開啟開發者模式 | `設定 → 隱私權與安全性 → 開發者模式` → 開啟後重啟手機 |
| 2. 安裝 Xcode 15+ | 從 Mac App Store 安裝（約 7–14 GB） |
| 3. 安裝 Python 3.13（iOS 18.2+ 必須） | `brew install python@3.13` |
| 4. 在專案目錄建立 venv 並安裝 pymobiledevice3 | `python3.13 -m venv .venv` <br> `.venv/bin/pip install "pymobiledevice3>=9.6"` |

**Windows（額外需求）：**

| 步驟 | 指令 / 說明 |
|------|------------|
| 1. 手機開啟開發者模式 | `設定 → 隱私權與安全性 → 開發者模式` → 開啟後重啟手機 |
| 2. 安裝 Python 3 | 至 python.org 下載，安裝時勾選「Add Python to PATH」|
| 3. 安裝 pymobiledevice3（需 9.6+） | `pip install "pymobiledevice3>=9.6"` |
| 4. 安裝 WireGuard（含 WinTun 驅動） | 至 wireguard.com/install 下載安裝 |

### 每次使用前的啟動順序

**macOS：**
```bash
# 步驟 A（首次或 USB 模式）：插上 iPhone USB，手機點「信任」
#          WiFi 模式：確認 iPhone 與 Mac 在同一個 WiFi，無需插線

# 步驟 B：啟動伺服器，選擇 iOS 模式
npm start
# → 選單選 2，tunneld 啟動後前端會自動偵測（約 15–30 秒）
```

**Windows（以系統管理員身份執行 PowerShell）：**
```powershell
# 步驟 A：插上 iPhone USB，手機點「信任」

# 步驟 B：啟動伺服器，選擇 iOS 模式
npm start
# → 出現選單後輸入 2，啟動器會自動執行 tunneld
```

確認裝置偵測成功（可選）：
```bash
# 開啟 http://localhost:3000 後，側邊欄裝置區塊會自動重試偵測（最多 60 秒）
# 成功時顯示：「iPhone 名稱 (iOS)」+ 連線方式（📶 WiFi 或 🔌 USB）
```

### iOS Troubleshooting

| 問題 | 解決方式 |
|------|----------|
| 裝置未偵測到 | 確認 tunneld 已執行；拔插 USB；手機點「信任」 |
| `QuicProtocolNotSupportedError`（iOS 18.2+） | 需要 Python 3.13：`brew install python@3.13`，然後在專案目錄重建 venv |
| 等待 60 秒後仍未偵測到裝置 | 確認 iPhone 與 Mac 在同一個 WiFi；或改用 USB 連線；tunneld 初次掃描約需 15–30 秒 |
| WiFi 連線後裝置消失 | 確認手機螢幕未鎖定（部分情況鎖屏會斷開 mDNS）；或拔插 USB 重新信任 |
| `pymobiledevice3: command not found` | 執行 `python3.13 -m venv .venv && .venv/bin/pip install "pymobiledevice3>=9.6"` |
| `xcode-select: error`（macOS） | 執行 `xcode-select --install` |
| tunneld 無法啟動（Windows） | 確認已安裝 WireGuard；確認以系統管理員身份執行 PowerShell |
| GPS 不生效 | 確認 iPhone iOS 17+；確認 tunneld 仍在執行 |

## 📱 iOS Device Setup (iOS 17+, Optional)

> Android users can skip this section.

### One-time installation

**macOS:**

| Step | Command / Note |
|------|----------------|
| 1. Enable Developer Mode | `Settings → Privacy & Security → Developer Mode` → reboot |
| 2. Install Xcode 15+ | From Mac App Store (~7–14 GB) |
| 3. Install Python 3.13 (required for iOS 18.2+) | `brew install python@3.13` |
| 4. Create a venv in the project directory and install pymobiledevice3 | `python3.13 -m venv .venv` <br> `.venv/bin/pip install "pymobiledevice3>=9.6"` |

**Windows (extra requirements):**

| Step | Command / Note |
|------|----------------|
| 1. Enable Developer Mode | `Settings → Privacy & Security → Developer Mode` → reboot |
| 2. Install Python 3 | Download from python.org; check "Add Python to PATH" |
| 3. Install pymobiledevice3 (9.6+ required) | `pip install "pymobiledevice3>=9.6"` |
| 4. Install WireGuard (includes WinTun driver) | Download from wireguard.com/install |

### Startup order (required every session)

**macOS:**
```bash
# Step A (first time or USB mode): Plug in iPhone via USB, tap "Trust" on device
#         WiFi mode: Confirm iPhone and Mac are on the same WiFi — no cable needed

# Step B: Start the server and select iOS mode
npm start
# → When the menu appears, enter 2 — tunneld will start and the frontend auto-detects (approx. 15–30 sec)
```

**Windows (run PowerShell as Administrator):**
```powershell
# Step A: Plug in iPhone via USB, tap "Trust" on device

# Step B: Start the server and select iOS mode
npm start
# → When the menu appears, enter 2 — the launcher auto-starts tunneld
```

Verify device detection (optional):
```bash
# Open http://localhost:3000 — the device panel in the sidebar will auto-retry detection (up to 60 sec)
# On success it shows: "iPhone Name (iOS)" + connection type (📶 WiFi or 🔌 USB)
```

### iOS Troubleshooting

| Problem | Fix |
|---------|-----|
| Device not detected | Confirm tunneld is running; re-plug USB; tap "Trust" on device |
| `QuicProtocolNotSupportedError` (iOS 18.2+) | Python 3.13 is required: `brew install python@3.13`, then recreate the venv in the project directory |
| No device detected after 60 seconds | Confirm iPhone and Mac are on the same WiFi; or switch to USB; tunneld initial scan takes ~15–30 sec |
| Device disappears after WiFi connection | Ensure phone screen is not locked (lock screen can break mDNS in some cases); or re-plug USB and tap "Trust" |
| `pymobiledevice3: command not found` | Run `python3.13 -m venv .venv && .venv/bin/pip install "pymobiledevice3>=9.6"` |
| `xcode-select: error` (macOS) | Run `xcode-select --install` |
| tunneld won't start (Windows) | Confirm WireGuard is installed; confirm PowerShell is running as Administrator |
| GPS has no effect | Confirm iOS 17+; confirm tunneld is still running |

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
