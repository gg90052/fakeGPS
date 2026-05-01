# pikGPS — iOS-only 重構設計文件

- **日期**：2026-05-01
- **狀態**：待實作
- **背景**：Android 相關功能已移轉至獨立的 pikGPS 專案；本 repo（master 分支）轉為專注 iOS。

---

## 目標

將目前同時支援 Android（透過 ADB + Appium Settings）與 iOS（透過 pymobiledevice3 DVT）的雙驅動架構，重構為僅支援 iOS 的單一驅動架構，並完整保留 Android 版本的歷史快照供日後追溯。

## 非目標

- 不改變地圖、路徑播放、keepalive、最愛地點、歷史記錄、GPX 載入等與平台無關的核心邏輯
- 不重新設計前端 UI 視覺
- 不改變 iOS 連線方式（仍透過 `pymobiledevice3` + tunneld）

---

## 1. 保存策略：Tag + 分支

在動任何檔案之前，先用 git 鎖住目前快照：

```bash
git tag archive/android-ios-mixed -m "iOS-only 重構前的最後快照（含 Android 雙驅動）"
git branch archive/android-mixed
git push origin archive/android-ios-mixed
git push origin archive/android-mixed
```

- `archive/android-ios-mixed`（tag）：永久標記，不再推進
- `archive/android-mixed`（branch）：保留，必要時可 cherry-pick 或追加 commit
- 兩者都推上 `origin`（github.com/gg90052/fakeGPS）

**驗收**：`git show archive/android-ios-mixed` 可顯示舊架構檔案內容；遠端也存在。

---

## 2. 檔案層清理

### 刪除

- `appium-settings.apk`（根目錄，1.5 MB）— Android 假 GPS 模擬 APK
- `flutter_app/` — 已轉移至獨立 pikGPS repo

### 保留

- `ios_location_daemon.py`、`ios_list_devices.py` — iOS 仍需要
- `.venv/` — Python 3.13 + pymobiledevice3 執行環境（不入 git）

### `.gitignore` 補強

```
node_modules/
.env
.env.*
.DS_Store
*.log
.claude/
.venv/
```

新增 `.venv/`（雖然 git 目前沒追蹤，補上以策安全）。

---

## 3. 後端 iOS-only 化

### 3.1 `package.json`

- `"name": "android-fakegps"` → `"pikgps"`
- 補上 `"description": "iOS GPS 位置模擬控制台"`
- 移除 `"directories": { "doc": "docs" }`（無實際作用）

### 3.2 `server.js`

#### 移除的狀態變數

- `useForegroundService` — Android 8+ 前景服務判斷
- `currentDriver` — 'android' / 'ios' 雙驅動切換
- `currentAndroidSerial` — Android 多裝置 serial
- 裝置物件中的 `androidSerial`、`androidSdk`、`platform` 欄位（iOS-only 後 platform 永遠是 ios，可省略）

#### `activateDevice(device)` 簡化

原本依 `device.platform` 分支處理。改為：

```js
function activateDevice(device) {
  selectedDeviceId = device.id;
  if (!iosProcess) startIosDaemon();
}
```

#### `sendLocation(lat, lng)` 簡化

移除 `currentDriver === 'android'` 分支與 `adb shell am start-foreground-service / startservice ...` 指令。只保留 iOS daemon stdin 寫入：

```js
function sendLocation(lat, lng) {
  if (!isFinite(lat) || !isFinite(lng)) return;
  if (iosProcess && iosDaemonReady) {
    iosProcess.stdin.write(`${lat},${lng}\n`);
  }
}
```

#### `/api/devices` 簡化

- 移除 `exec('adb devices', ...)` 與 `adb shell getprop ro.product.model / ro.build.version.sdk`
- 只保留 iOS USB（`pymobiledevice3 usbmux list`）+ iOS WiFi（`ios_list_devices.py`）兩個來源
- 裝置物件統一形狀：`{ id, name, connection: 'usb' | 'wifi' }`
- 自動啟動邏輯與裝置消失時的清理邏輯保留

#### `/api/status` 調整

- 移除 `driver` 欄位
- 保留 `iosState`、`iosDaemonError`

#### `/api/device` (單裝置精簡查詢)

- 回應移除 `platform` 欄位

#### 保留不變的部分

- 路徑播放（`/api/route/start|pause|resume|stop|status`）
- keepalive（`/api/keepalive` GET / POST）
- 座標驗證
- `addGpsJitter` / `haversineDistance` / 隨機抖動邏輯
- `_routeTick` 路徑播放核心

### 3.3 `start.js`

移除 Android / iOS 選單：

- 刪除 `readline` 互動式 `ask()` 流程
- 刪除選擇 1 / 2 的判斷
- 直接執行：印出 iOS 前置提示 → `startIosTunnel()` → `startServer()`

保留：
- `spawnTracked` 子程序追蹤
- `cleanup` 與 SIGINT/SIGTERM/exit 訊號處理
- `startIosTunnel` 的 sudo + tunneld 啟動邏輯
- 5 秒超時 fallback

---

## 4. 前端精簡

### 4.1 `public/app.js`

#### 移除

- `PLATFORM_LABELS`（`{ ios: ' (iOS)', android: ' (Android)' }`）— iOS-only 後不需要平台標籤

#### 修改

- `updateDeviceInfo(devices, selectedId, statusData)`：
  - 移除 `device.platform === 'ios'` 條件判斷（永遠當作 iOS）
  - 直接顯示 connection label + DVT daemon 狀態

- `refreshDevice()` 內下拉選單 label 組裝：
  - 從 `${d.name}${platLabel}${connLabel ? ' ' + connLabel : ''}`
  - 改為 `${d.name}${connLabel ? ' ' + connLabel : ''}`

#### 保留不變

- `CONNECTION_LABELS`（USB / WiFi 仍有意義）
- `deviceRetryTimer` / `deviceRetryCount` 自動重試機制（iOS tunneld 啟動需要）
- 地圖、路徑、最愛、歷史、GPX、keepalive 等所有與平台無關邏輯

### 4.2 `public/index.html`

- `<title>` 已是 `pikGPS`，無需變更
- HTML 中無 Android 字眼，無需變更

---

## 5. 文件全面重寫（iOS-only）

採用「完全重寫」策略：刪除所有 Android 段落、章節、對照表，把 iOS 部分提升為主軸。

### `README.md`

- 移除 `![Platform](Android)` badge
- 「功能特色」段落：移除 Android-specific 描述（如 ADB-based 架構、Appium Settings 等）
- 「系統需求」表：移除 ADB、Android 手機列；iOS 前置需求提升為主表
- 「iOS 裝置前置需求」標題簡化為「系統需求」
- 「📡 裝置自動偵測」文案改為純 iOS 描述（USB / WiFi）

### `quickinstall.md`

完全重寫，從以下流程開始：

1. macOS + Python 3.13 + Xcode 15+ 前置安裝
2. iPhone 開啟開發者模式
3. USB 連接並信任電腦
4. `npm install`
5. 直接 `npm start`（無選單）

移除：
- `adb install appium-settings.apk`
- 「開發者選項 → 模擬位置」
- npm start 後的 1/2 選單步驟

### `tutor.md`

完全重寫成 iOS-only 新手教學：

- 移除 Android USB 偵錯、Appium Settings、模擬位置等章節
- 保留地圖操作、路徑規劃、最愛、GPX 載入等 UI 教學
- 補強 iOS 開發者模式、USB/WiFi 配對、tunneld 啟動細節

### `docs/plans/`

保留全部 4 份歷史文件不動：
- `2026-03-04-android-fakegps-design.md`
- `2026-03-04-android-fakegps-plan.md`
- `2026-03-09-ios-support-design.md`
- `2026-03-09-ios-support.md`

這些是有時間戳的歷史快照，不會誤導讀者。

---

## 6. 執行順序（分階段 atomic commits）

每個 commit 結束時專案處於可運作狀態。

1. **commit 1**：建立 tag + archive 分支並推上 origin（無檔案變動）
2. **commit 2**：刪除 `appium-settings.apk` + `flutter_app/` + 補強 `.gitignore`
3. **commit 3**：`server.js` + `start.js` iOS-only 化
4. **commit 4**：`public/app.js` 移除 Android 欄位/標籤
5. **commit 5**：`package.json` 改名為 `pikgps`
6. **commit 6**：文件重寫（README / quickinstall / tutor）

---

## 7. 驗收標準

1. `git tag` 顯示 `archive/android-ios-mixed`，遠端也有
2. `git branch` 顯示 `archive/android-mixed`，遠端也有
3. `npm start` 直接啟動 iOS tunnel + server，無 Android 選單互動
4. 連接 iPhone（USB 或 WiFi）後，前端裝置選單可正確顯示與切換
5. 改變定位、keepalive 鎖定、路徑播放、GPX 載入皆正常運作
6. 全文搜尋 `android`/`adb`/`appium`（排除 `node_modules`、`.venv`、`.git`、`docs/plans`）應無命中
7. `package.json` name 為 `pikgps`
8. README / quickinstall / tutor 無 Android 章節

---

## 8. 風險與注意事項

- **`activateDevice()` 副作用**：裝置消失時仍需 `stopIosDaemon()` + `stopKeepalive()`，確保不會殘留 daemon 程序
- **tunneld 仍依賴 sudo**：`start.js` 啟動時 `sudo pymobiledevice3 remote tunneld`，這是 pymobiledevice3 的限制，無法繞過
- **測試方式**：本專案無自動化測試，UI 與 iOS 連線變動需在瀏覽器 + 實體 iPhone 操作驗證
- **archive 分支推上 GitHub**：確認 `origin` 是預期的 repo（`github.com/gg90052/fakeGPS`），不是另一個 pikgps remote
