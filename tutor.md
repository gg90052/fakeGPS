# 📖 pikGPS 完全新手教學

> 如果你完全沒有寫程式經驗，這份教學會帶你從零完成 iOS 的假 GPS 工具設定。

---

## 目錄

1. [這個工具是什麼？能做什麼？](#1-這個工具是什麼能做什麼)
2. [你需要準備什麼](#2-你需要準備什麼)
3. [安裝 Node.js（讓程式能跑起來）](#3-安裝-nodejs讓程式能跑起來)
4. [iOS 裝置設定（iOS 17+）](#4-ios-裝置設定ios-17)
5. [下載並啟動 pikGPS 工具](#5-下載並啟動-pikgps-工具)
6. [第一次打開網頁：認識畫面](#6-第一次打開網頁認識畫面)
7. [功能教學：設定假 GPS 位置](#7-功能教學設定假-gps-位置)
8. [功能教學：規劃路徑並播放移動](#8-功能教學規劃路徑並播放移動)
9. [功能教學：最愛地點與最愛路徑](#9-功能教學最愛地點與最愛路徑)
10. [功能教學：GPS 鎖定（Keepalive）](#10-功能教學gps-鎖定keepalive)
11. [功能教學：歷史記錄](#11-功能教學歷史記錄)
12. [（選用）使用 Google Maps](#12-選用使用-google-maps)
13. [常見問題與解決方法](#13-常見問題與解決方法)
14. [名詞解說](#14-名詞解說)

---

## 1. 這個工具是什麼？能做什麼？

### 簡單說

pikGPS 是一個跑在你 Mac（或 Windows）上的網頁工具，可以**讓你的 iPhone 假裝它在世界上的任何位置**。打開瀏覽器，點地圖一下，iPhone 的 GPS 就會跟著移動。

### 實際用途

- 開發或測試需要 GPS 的 App
- 在家就能體驗不同地點的 LBS 功能
- 為各種需要 GPS 的測試情境模擬位置

### 這個工具的工作原理（不用全懂，了解大概就好）

```
你的瀏覽器（地圖介面）
       │
       ▼
你電腦上的伺服器（Node.js）
       │
       ▼
pymobiledevice3 tunneld（透過 USB 或 WiFi 與 iPhone 通訊）
       │
       ▼
iPhone（DVT LocationSimulation 改變 GPS）
```

---

## 2. 你需要準備什麼

### 硬體

- **Mac 電腦**（推薦；Windows 也可但穩定性較低）
- **iPhone（iOS 17 以上）**
- **USB 連接線**（首次配對用，之後可改用 WiFi）

### 軟體（稍後會一步一步教你安裝）

1. **Node.js**（讓電腦能執行這個工具）
2. **Xcode 15+**（pymobiledevice3 依賴其底層框架）
3. **Python 3.13**（iOS 18.2 以上必須）
4. **pymobiledevice3 9.6+**（與 iPhone 溝通的橋樑）

---

## 3. 安裝 Node.js（讓程式能跑起來）

### macOS 使用者

最簡單的方式是透過 [Homebrew](https://brew.sh)：

1. 打開「終端機」（Spotlight 搜尋「terminal」）
2. 安裝 Homebrew（若還沒裝過）：
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
3. 安裝 Node.js：
   ```bash
   brew install node
   ```
4. 確認安裝成功：
   ```bash
   node --version
   # 應顯示 v14 以上的版本號
   ```

### Windows 使用者

1. 前往 [nodejs.org](https://nodejs.org)
2. 下載 **LTS 版本**（左邊綠色按鈕）
3. 執行安裝程式，全部按「下一步」即可
4. 安裝後開啟 PowerShell，輸入 `node --version` 確認

---

## 4. iOS 裝置設定（iOS 17+）

### 為什麼 iPhone 需要額外設定？

Apple 預設禁止外部修改 GPS。本工具透過開發者工具（DVT）通道改變位置，這需要你的 iPhone 開啟「開發者模式」。

### 前置條件

- iPhone 必須是 **iOS 17 以上**
- Mac 電腦（推薦）或 Windows 電腦
- 一條可以用的 USB 線（首次配對需要）

---

### 步驟一：開啟 iPhone 開發者模式

1. 在 iPhone 上前往「**設定 → 隱私權與安全性 → 開發者模式**」
2. 開啟「開發者模式」
3. 系統會要求**重新啟動 iPhone**，按「重新啟動」
4. 重啟後，再次回到此頁確認已開啟

---

### 步驟二：安裝 Xcode（macOS 使用者）

1. 從 Mac App Store 搜尋並安裝 **Xcode**（檔案約 7–14 GB，需要一些時間）
2. 安裝完成後開啟一次 Xcode，同意授權條款
3. （可選）安裝命令列工具：
   ```bash
   xcode-select --install
   ```

---

### 步驟三：安裝 Python 3.13 與 pymobiledevice3

iOS 18.2 以上的裝置需要 Python 3.13，舊版本可能無法連線。

**macOS：**

```bash
# 1. 安裝 Python 3.13
brew install python@3.13

# 2. 進入專案目錄（後面會教你下載專案）後，建立虛擬環境
python3.13 -m venv .venv

# 3. 安裝 pymobiledevice3
.venv/bin/pip install "pymobiledevice3>=9.6"

# 4. 確認安裝成功
.venv/bin/pymobiledevice3 --version
# 應顯示 9.6 以上的版本號碼
```

**Windows：**

1. 前往 [python.org](https://www.python.org/downloads/)
2. 下載 Python 3 並執行安裝程式
3. **重要：勾選「Add Python to PATH」**
4. 開啟 PowerShell：
   ```powershell
   pip install "pymobiledevice3>=9.6"
   ```
5. 安裝 [WireGuard for Windows](https://www.wireguard.com/install/)（提供 tunneld 所需的 WinTun 驅動）

---

### 步驟四：連接 iPhone 並信任電腦

1. 用 USB 線把 iPhone 連到電腦
2. iPhone 螢幕會跳出「**信任這台電腦？**」，點「**信任**」並輸入密碼
3. 之後同一台電腦不會再問

> **WiFi 模式說明：** 完成首次 USB 配對後，只要 iPhone 與電腦在同一個 WiFi 網路，就可以拔掉線改用 WiFi 連線（需保持 iPhone 螢幕不上鎖）。

---

## 5. 下載並啟動 pikGPS 工具

### 下載專案

開啟終端機，找一個你想放程式的資料夾（例如桌面），然後執行：

```bash
git clone git@github.com:gg90052/fakeGPS.git
cd fakeGPS
```

> 如果沒有 git，可以從 GitHub 網頁直接下載 ZIP，解壓後 `cd` 進去那個資料夾。

### 安裝套件

```bash
npm install
```

這一步會下載伺服器需要的所有元件，可能需要 1–2 分鐘。

### 第一次啟動：建立 Python 虛擬環境

如果還沒做過，現在做：

```bash
python3.13 -m venv .venv
.venv/bin/pip install "pymobiledevice3>=9.6"
```

### 啟動伺服器

```bash
npm start
```

成功時會看到：
```
=== pikGPS 啟動器（iOS） ===

正在啟動 pymobiledevice3 通道（需要 sudo 權限）...
[需要時會提示輸入 Mac 密碼]
[tunneld] ...
通道已啟動，正在啟動伺服器...
Server running at http://localhost:3000
```

> 第一次會要求 sudo 密碼（輸入你的 Mac 登入密碼），這是 tunneld 啟動所需。

### 打開網頁控制台

打開瀏覽器，前往 [http://localhost:3000](http://localhost:3000)

---

## 6. 第一次打開網頁：認識畫面

```
┌─────────────────────────┬──────────────────────────────┐
│  ★ Google Maps API Key  │                              │
│  ─────────────────────  │                              │
│  pikGPS 控制台          │                              │
│                         │                              │
│  ┌ 裝置選擇 ──────────┐ │                              │
│  │ iPhone XX  📶 WiFi │ │           [地圖區]           │
│  │ [重新整理]         │ │                              │
│  │ 🔒 GPS 鎖定中      │ │                              │
│  └────────────────────┘ │                              │
│                         │                              │
│  ┌ 位置設定 ──────────┐ │                              │
│  │ 搜尋  [_________]  │ │                              │
│  │ 座標  [_________]  │ │                              │
│  │ [✓ 改變定位] [↩]   │ │                              │
│  └────────────────────┘ │                              │
│                         │                              │
│  ┌ 路徑規劃 ──────────┐ │                              │
│  │ [開啟航點模式]     │ │                              │
│  │ [📂 載入 GPX]      │ │                              │
│  │ ▶ 開始 / ■ 停止    │ │                              │
│  └────────────────────┘ │                              │
└─────────────────────────┴──────────────────────────────┘
```

### 各區塊說明

- **API Key**：填 Google Maps Key 用 Google 地圖；留空用免費的 OpenStreetMap
- **裝置選擇**：自動偵測連到電腦的 iPhone，顯示連線方式（USB / WiFi）
- **位置設定**：搜尋、輸入或點地圖確認位置
- **路徑規劃**：設定多個點讓 GPS 自動移動

### 確認裝置已連線

側邊欄裝置區塊應該會在 60 秒內顯示你的 iPhone 名稱與「✓ DVT 已就緒」。如果沒有，去看[第 13 章常見問題](#13-常見問題與解決方法)。

---

## 7. 功能教學：設定假 GPS 位置

### 方法一：搜尋地點名稱

1. 在側邊欄的「**地點搜尋**」框輸入「東京鐵塔」、「台北101」等
2. 按 **Enter**
3. 地圖會跳到該位置並顯示**黃色預覽標記**
4. 確認後按「**✓ 改變定位**」 → iPhone GPS 立即跳到那個位置

### 方法二：直接點擊地圖

1. 找到目標位置
2. 點擊地圖 → **黃色預覽標記**出現
3. 按「**✓ 改變定位**」 → iPhone GPS 跳過去

### 方法三：手動輸入座標

1. 在「**座標**」框輸入「`25.033611, 121.564722`」（緯度, 經度）
2. 按 **Enter** → 預覽
3. 按「**✓ 改變定位**」 → 送出

### ↩ 按鈕（回到目前定位）

當你瀏覽地圖跑到別的地方，可隨時按圓形「↩」按鈕，地圖會跳回目前 iPhone 的 GPS 位置。

---

## 8. 功能教學：規劃路徑並播放移動

### 方法 A：手動在地圖上設定航點

#### 步驟一：開啟航點模式

1. 點「**開啟航點模式**」按鈕

#### 步驟二：在地圖上設定目的地

2. 在地圖上點擊每個目的地，**至少 1 個航點**
3. 路徑會自動以「目前位置」為起點

#### 步驟三：調整移動速度

4. 拖曳速度滑桿（1–50 km/h）
   - 走路：3–5
   - 跑步：8–12
   - 騎車：15–25
   - 開車：40–50

#### 步驟四：開始播放

5. 點「**▶ 開始播放**」 → 藍色路線出現，標記沿著路線移動

#### 步驟五：暫停 / 停止

6. 播放中按鈕變「**⏸ 暫停**」，可隨時暫停
7. 按「**■ 停止**」中止並清除路徑

#### 注意事項

- 若第一個航點與目前位置距離超過 **20 km**，會跳出確認視窗

---

### 方法 B：載入 GPX 檔案

1. 點「**📂 載入 GPX**」
2. 選擇 `.gpx` 檔案
3. 自動填入所有航點，並把 iPhone GPS 移到第一個航點
4. 超過 300 個點會自動均勻取樣

> GPX 是 GPS 軌跡的標準格式。Strava、Komoot 等 App 匯出的軌跡都可以用。

---

## 9. 功能教學：最愛地點與最愛路徑

### 儲存最愛地點

1. 設定一個位置（任何方式）
2. 點「**★ 加入最愛地點**」
3. 輸入名稱（例如「家」、「公司」）

### 載入最愛地點

1. 在最愛清單點「📍」 → 載入為**預覽**
2. 確認後按「**✓ 改變定位**」送出

### 儲存最愛路徑

1. 設定多個航點
2. 點「**★ 儲存路徑**」
3. 輸入名稱

### 載入最愛路徑

1. 在最愛路徑清單點「▶」 → 自動填入所有航點
2. 按「**▶ 開始播放**」即可移動

---

## 10. 功能教學：GPS 鎖定（Keepalive）

### 為什麼需要這個功能？

iPhone 的 GPS 系統會持續更新，所以即使我們送了一次假位置，過幾秒後它可能會「修正」回真實位置。鎖定功能會每 2 秒重送一次，確保 GPS 不會跑掉。

### 怎麼使用

- 送出座標後**自動啟用**，側邊欄會顯示「🔒 GPS 鎖定中」
- 按「**暫停鎖定**」可暫停（顯示「⏸ 未鎖定」）
- 按「**恢復鎖定**」可重新啟動

---

## 11. 功能教學：歷史記錄

每次「✓ 改變定位」後，座標會自動加入歷史記錄（最多 10 筆）。

### 查看歷史記錄

點側邊欄「**歷史記錄**」展開清單。

### 載入歷史位置

點某筆紀錄的「📍」 → 載入為預覽，按「**✓ 改變定位**」即可。

---

## 12. （選用）使用 Google Maps

留空 API Key 預設使用免費的 OpenStreetMap，已可滿足大部分需求。

### 取得 Google Maps API Key

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立或選擇一個專案
3. 啟用 **Maps JavaScript API** 與 **Places API**
4. 到「憑證」→「建立憑證」→「API 金鑰」
5. 建議設定 HTTP 參照網址限制（`http://localhost:3000/*`）

> Google Maps 有免費額度，個人使用通常用不完，但記得設定預算警示。

### 輸入 API Key

1. 把 Key 貼到側邊欄最上方「**Google Maps API Key**」框
2. 按「**套用並重新載入**」 → 頁面刷新後即可使用 Google Maps

### 切回 OpenStreetMap

按「**清除（用免費地圖）**」 → 頁面刷新後使用免費地圖。

---

## 13. 常見問題與解決方法

### ❌ 問題：打開網頁後地圖不顯示

**原因**：API Key 無效或瀏覽器封鎖外部連線

**解決方法**：
1. 清除 API Key 並重試（會自動切到 OpenStreetMap）
2. 確認電腦能上網

---

### ❌ 問題：裝置選擇顯示「未偵測到裝置」（iOS）

**解決方法（依序嘗試）**：
1. 確認 iPhone 已用 USB 連到電腦並點過「信任」
2. 拔插 USB 重新嘗試
3. 確認 `npm start` 啟動時 tunneld 沒有錯誤
4. 等 60 秒（前端會自動重試）
5. 重啟 iPhone 與電腦

---

### ❌ 問題：GPS 設定後 iPhone 的 App 沒有反應

**解決方法**：
1. 確認側邊欄顯示「✓ DVT 已就緒」
2. 確認 iPhone 沒有開 VPN（部分情況會干擾）
3. 重啟伺服器（Ctrl+C → `npm start`）

---

### ❌ 問題：GPS 維持假位置一段時間後自動恢復真實位置

**解決方法**：
1. 確認側邊欄顯示「🔒 GPS 鎖定中」
2. 若顯示「⏸ 未鎖定」，點「**恢復鎖定**」

---

### ❌ 問題：執行 tunneld 時出現錯誤

**解決方法**：
1. 確認 macOS 已輸入正確的 sudo 密碼
2. 確認 `.venv/bin/pymobiledevice3 --version` 能正常顯示
3. 重新建立 venv：
   ```bash
   rm -rf .venv
   python3.13 -m venv .venv
   .venv/bin/pip install "pymobiledevice3>=9.6"
   ```

---

### ❌ 問題：tunneld 出現 `QuicProtocolNotSupportedError`

**原因**：iOS 18.2+ TCP 模式需要 Python 3.13

**解決方法**：
```bash
brew install python@3.13
rm -rf .venv
python3.13 -m venv .venv
.venv/bin/pip install "pymobiledevice3>=9.6"
```

---

### ❌ 問題：裝置選擇顯示「⚠ iOS 連線中斷（Channel is closed）」

**原因**：DVT 通道意外中斷

**解決方法**：重新啟動伺服器（Ctrl+C → `npm start`）。

---

### ❌ 問題：等待超過 60 秒後顯示「逾時，請確認裝置後手動重試」

**解決方法**：
1. 確認 iPhone 與 Mac 在同一個 WiFi 網路；或改用 USB 連線
2. 點側邊欄「重新整理」按鈕
3. 重啟 iPhone

---

### ❌ 問題：在 Windows 上輸入 `node` 出現「不是有效的命令」

**原因**：Node.js 沒有加入 PATH

**解決方法**：重新執行 Node.js 安裝程式，安裝時勾選「Add to PATH」。

---

### ❌ 問題：`npm install` 出現很多錯誤

**解決方法**：
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## 14. 名詞解說

| 名詞 | 意思 |
|------|------|
| **DVT** | Apple 的 Developer Tools 通道，本工具用來改變 GPS 位置的官方介面 |
| **tunneld** | pymobiledevice3 提供的常駐程式，建立 Mac 與 iPhone 之間的安全通道 |
| **pymobiledevice3** | Python 套件，與 iOS 裝置溝通的底層工具 |
| **Node.js** | 一種讓電腦能執行 JavaScript 的環境 |
| **localhost** | 你自己的電腦，網址 http://localhost:3000 = 連到自己 |
| **localStorage** | 瀏覽器內建的小型儲存空間，用來記住設定 |
| **GPX** | GPS 軌跡檔案的標準格式 |
| **Keepalive** | 持續送出訊號，防止連線中斷 |

---

## 完成！🎉

你現在可以在世界各地「移動」了。如果遇到問題，先看[第 13 章常見問題](#13-常見問題與解決方法)，多數問題都能解決。

> ⚠️ **再提醒一次**：本工具僅供個人測試用，請勿用於違反任何 App 服務條款的行為。

---
