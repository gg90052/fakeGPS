# iOS Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 server.js 加入 iOS 裝置支援（iOS 17+），透過 pymobiledevice3 注入 GPS 座標，前端自動顯示裝置類型，無需使用者手動切換。

**Architecture:** 新增 `currentDriver` 全域變數（`'android' | 'ios' | null`），將 GPS 指令抽象成 `sendLocation()` 統一入口；`/api/device` 先偵測 Android（adb），失敗再偵測 iOS（pymobiledevice3 usbmux list），前端 `/api/device` 回傳多一個 `platform` 欄位顯示用。

**Tech Stack:** Node.js, Express, child_process.exec, pymobiledevice3 (Python CLI), ADB

---

### Task 1：重構 server.js — 加入 driver 抽象層與 iOS sendLocation

**Files:**
- Modify: `server.js`

**Step 1：加入 `currentDriver` 全域變數**

在 `server.js` 頂端（`useForegroundService` 下方）加入：

```js
// 裝置驅動類型：'android' | 'ios' | null
let currentDriver = null;
```

**Step 2：重構 `sendLocation()`**

將現有的 `sendLocation()` 改為根據 `currentDriver` 選擇指令：

```js
// 執行送座標（根據裝置類型選擇驅動）
function sendLocation(lat, lng) {
  if (currentDriver === 'android') {
    const svcCmd = useForegroundService ? 'start-foreground-service' : 'startservice';
    const cmd = `adb shell am ${svcCmd} -n io.appium.settings/.LocationService --es longitude "${lng}" --es latitude "${lat}"`;
    exec(cmd, () => {});
  } else if (currentDriver === 'ios') {
    const cmd = `pymobiledevice3 developer simulate-location set -- ${lat} ${lng}`;
    exec(cmd, () => {});
  }
}
```

**Step 3：手動驗證語法正確**

```bash
node -e "require('./server.js')" 2>&1 | head -5
# 預期：無 SyntaxError（會出現 Server running 或其他錯誤但不是語法錯）
# 用 Ctrl+C 中止
```

**Step 4：Commit**

```bash
git add server.js
git commit -m "重構：加入 currentDriver 抽象層與 iOS sendLocation 支援"
```

---

### Task 2：重構 `/api/device` — 加入 iOS 自動偵測

**Files:**
- Modify: `server.js`

**Step 1：將 `/api/device` 改為先偵測 Android、再偵測 iOS**

將整段 `/api/device` handler 替換為：

```js
app.get('/api/device', (req, res) => {
  // 先嘗試偵測 Android
  exec('adb devices', (error, stdout) => {
    if (!error) {
      const lines = stdout.split('\n').filter(l => l.trim() && !l.startsWith('List of devices'));
      const connected = lines.find(l => l.includes('\tdevice'));
      if (connected) {
        const device = connected.split('\t')[0].trim();
        exec('adb shell getprop ro.build.version.sdk', (err, sdkOut) => {
          const sdk = parseInt((sdkOut || '').trim(), 10);
          useForegroundService = !isNaN(sdk) && sdk >= 26;
          currentDriver = 'android';
          res.json({ device, platform: 'android', androidSdk: isNaN(sdk) ? null : sdk });
        });
        return;
      }
    }

    // Android 未找到，嘗試偵測 iOS
    exec('pymobiledevice3 usbmux list', (iosError, iosStdout) => {
      if (iosError || !iosStdout.trim() || iosStdout.trim() === '[]') {
        currentDriver = null;
        stopKeepalive();
        return res.json({ device: null, platform: null });
      }
      // 解析第一台裝置名稱（JSON 陣列格式）
      try {
        const devices = JSON.parse(iosStdout);
        if (!Array.isArray(devices) || devices.length === 0) {
          currentDriver = null;
          stopKeepalive();
          return res.json({ device: null, platform: null });
        }
        const iosDevice = devices[0].DeviceName || devices[0].UniqueDeviceID || 'iOS Device';
        currentDriver = 'ios';
        res.json({ device: iosDevice, platform: 'ios' });
      } catch {
        currentDriver = null;
        stopKeepalive();
        res.json({ device: null, platform: null });
      }
    });
  });
});
```

**Step 2：手動驗證語法**

```bash
node -e "require('./server.js')" 2>&1 | head -5
# Ctrl+C 中止
```

**Step 3：Commit**

```bash
git add server.js
git commit -m "功能：/api/device 加入 iOS 自動偵測，回傳 platform 欄位"
```

---

### Task 3：重構 `/api/location` — 移除內嵌 ADB 指令

**Files:**
- Modify: `server.js`

目前 `/api/location` 裡有重複的 ADB 指令拼接，需改為呼叫統一的 `sendLocation()`。

**Step 1：找到 `/api/location` 中重複的 ADB 指令**

目前是：
```js
const svcCmd = useForegroundService ? 'start-foreground-service' : 'startservice';
const cmd = `adb shell am ${svcCmd} -n io.appium.settings/.LocationService --es longitude "${lng}" --es latitude "${lat}"`;
exec(cmd, (error) => {
  if (error) {
    return res.json({ success: false, error: error.message });
  }
  startKeepalive(lat, lng);
  res.json({ success: true });
});
```

**Step 2：改為使用 `sendLocation()` 並加入裝置檢查**

將 `/api/location` handler 的 exec 區塊替換為：

```js
app.post('/api/location', (req, res) => {
  const { lat, lng } = req.body;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.json({ success: false, error: '無效的座標' });
  }
  if (!isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.json({ success: false, error: '座標超出有效範圍（lat: -90~90, lng: -180~180）' });
  }
  if (!currentDriver) {
    return res.json({ success: false, error: '尚未連接裝置' });
  }
  sendLocation(lat, lng);
  startKeepalive(lat, lng);
  res.json({ success: true });
});
```

注意：iOS 的 `pymobiledevice3` 指令執行較慢，改為 fire-and-forget（與 Android keepalive 行為一致）。

**Step 3：手動驗證語法**

```bash
node -e "require('./server.js')" 2>&1 | head -5
# Ctrl+C 中止
```

**Step 4：Commit**

```bash
git add server.js
git commit -m "重構：/api/location 改用統一 sendLocation()，加入裝置連線檢查"
```

---

### Task 4：更新前端 — 顯示 platform 資訊

**Files:**
- Modify: `public/app.js`

**Step 1：找到前端顯示裝置狀態的程式碼**

在 `app.js` 搜尋 `/api/device` 的處理，找到顯示裝置名稱的地方（通常是 `textContent` 或類似）。

**Step 2：在裝置名稱後加入平台標籤**

找到 response 的處理，在顯示 device 名稱時加入 platform：

```js
// 找到類似這樣的程式碼：
// deviceEl.textContent = data.device ? data.device : '未連接';
// 改為：
if (data.device) {
  const platformLabel = data.platform === 'ios' ? ' (iOS)' : data.platform === 'android' ? ' (Android)' : '';
  deviceEl.textContent = data.device + platformLabel;
} else {
  deviceEl.textContent = '未連接';
}
```

**Step 3：手動驗證：啟動 server 並開啟瀏覽器**

```bash
npm start
# 開啟 http://localhost:3000
# 確認裝置狀態區顯示正常（不論有無裝置連線）
```

**Step 4：Commit**

```bash
git add public/app.js
git commit -m "UI：裝置狀態顯示 Android/iOS 平台標籤"
```

---

### Task 5：更新文件

**Files:**
- Modify: `README.md`
- Modify: `quickinstall.md`
- Modify: `tutor.md`

**Step 1：README.md — 系統需求區塊加入 iOS 說明**

在系統需求表格後加入 iOS 前置需求區塊：

```markdown
### iOS 裝置前置需求（iOS 17+）

1. 手機開啟開發者模式：`設定 → 隱私權與安全性 → 開發者模式`
2. 電腦安裝 pymobiledevice3：
   ```bash
   pip3 install pymobiledevice3
   ```
3. 安裝 Xcode 15+（pymobiledevice3 依賴其底層框架）
4. 啟動前先執行 tunnel（每次重開電腦需重新執行）：
   ```bash
   sudo pymobiledevice3 remote tunneld
   ```
5. 手機連接 USB，信任此電腦
```

**Step 2：quickinstall.md — 加入 iOS 快速安裝段落**

在 Android 手機設定段落後加入：

```markdown
## 📱 iOS 裝置設定（iOS 17+）

| 步驟 | 指令 |
|------|------|
| 安裝 pymobiledevice3 | `pip3 install pymobiledevice3` |
| 啟動 tunnel（需 sudo） | `sudo pymobiledevice3 remote tunneld` |
| 驗證偵測到裝置 | `pymobiledevice3 usbmux list` |
```

**Step 3：tutor.md — 加入 iOS 章節**

在 ADB 安裝章節後加入新章節「iOS 裝置設定（iOS 17+）」，內容包含：
- 開啟開發者模式步驟截圖說明
- pymobiledevice3 安裝說明
- Xcode 需求說明
- tunnel 啟動方式與注意事項

**Step 4：Commit**

```bash
git add README.md quickinstall.md tutor.md
git commit -m "文件：加入 iOS 17+ 前置需求與安裝說明"
```

---

### Task 6：推送分支

**Step 1：推送 feature branch 到遠端**

```bash
git push -u origin feature/ios-support
```

**Step 2：確認所有 commit 正確**

```bash
git log --oneline
# 預期看到 5 個新 commit 在 master 之上
```
