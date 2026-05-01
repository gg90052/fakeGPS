# pikGPS — iOS-only 重構實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將 pikGPS 從 Android + iOS 雙驅動架構重構為僅支援 iOS，並完整保留舊架構快照於 git tag 與分支中。

**Architecture:** 移除所有 Android 相關程式碼（adb 指令、Appium Settings、雙驅動切換）、檔案（apk、flutter_app）與文件章節；保留 iOS DVT/tunneld 機制與所有與平台無關的核心邏輯（路徑播放、keepalive、最愛、GPX、地圖）。執行採 6 個 atomic commit 分階段推進，每個 commit 結束時專案皆處於可運作狀態。

**Tech Stack:** Node.js (Express)、原生 JavaScript（前端）、Python 3.13 + pymobiledevice3、Git。

**參考設計文件：** `docs/superpowers/specs/2026-05-01-ios-only-refactor-design.md`

---

## 前置條件

- 工作目錄：`/Users/teddyhuang/Documents/fakeGPS`
- 當前分支：`master`
- 開始前先執行 `git status` 確認 working tree 乾淨
- 遠端只剩 `origin`（github.com/gg90052/fakeGPS）；若仍有 `pikgps` remote 請先 `git remote remove pikgps`

---

## Task 1：建立 archive tag 與分支並推送遠端

**Files:** 不變更檔案，只動 git refs

- [ ] **Step 1.1：確認 working tree 乾淨**

Run: `git status`
Expected: `nothing to commit, working tree clean`（spec 文件已 commit）

- [ ] **Step 1.2：建立 annotated tag 標記當前 master HEAD**

Run:
```bash
git tag -a archive/android-ios-mixed -m "iOS-only 重構前的最後快照（含 Android 雙驅動）"
```

- [ ] **Step 1.3：建立 archive 分支**

Run:
```bash
git branch archive/android-mixed
```

- [ ] **Step 1.4：驗證 tag 與分支已建立**

Run:
```bash
git tag --list 'archive/*'
git branch --list 'archive/*'
```
Expected：`archive/android-ios-mixed` 出現在 tag list；`archive/android-mixed` 出現在 branch list。

- [ ] **Step 1.5：推送 tag 到 origin**

Run:
```bash
git push origin archive/android-ios-mixed
```
Expected：`* [new tag] archive/android-ios-mixed -> archive/android-ios-mixed`

- [ ] **Step 1.6：推送 archive 分支到 origin**

Run:
```bash
git push -u origin archive/android-mixed
```
Expected：`* [new branch] archive/android-mixed -> archive/android-mixed`

- [ ] **Step 1.7：驗證遠端已收到 tag 與分支**

Run:
```bash
git ls-remote --tags origin archive/android-ios-mixed
git ls-remote --heads origin archive/android-mixed
```
Expected：兩個指令各回一行 SHA + ref 名稱。

> 本任務無 commit（只動 refs），直接進入 Task 2。

---

## Task 2：刪除 Android 專屬檔案 + 補強 .gitignore

**Files:**
- Delete: `appium-settings.apk`
- Delete: `flutter_app/`（整個目錄）
- Modify: `.gitignore`

- [ ] **Step 2.1：刪除 appium-settings.apk**

Run:
```bash
git rm appium-settings.apk
```
Expected：`rm 'appium-settings.apk'`

- [ ] **Step 2.2：刪除 flutter_app/ 整個目錄**

Run:
```bash
git rm -r flutter_app
```
Expected：列出大量檔案被移除（含 `flutter_app/lib/...`、`flutter_app/android/...` 等）。

- [ ] **Step 2.3：更新 .gitignore 加入 .venv/**

修改 `.gitignore`，將內容改為：
```
node_modules/
.env
.env.*
.DS_Store
*.log
.claude/
.venv/
```

（在最後一行加上 `.venv/`，其他不變）

- [ ] **Step 2.4：確認 .venv 目前未被追蹤**

Run:
```bash
git ls-files .venv | head -1
```
Expected：無輸出（git 沒在追蹤 `.venv/`，補 .gitignore 純粹預防）。

- [ ] **Step 2.5：確認 working tree 狀態**

Run: `git status`
Expected：
```
deleted: appium-settings.apk
deleted: flutter_app/...（多個檔案）
modified: .gitignore
```

- [ ] **Step 2.6：Commit**

```bash
git add .gitignore
git commit -m "$(cat <<'EOF'
chore: 移除 Android 專屬檔案

- 刪除 appium-settings.apk（Android 假 GPS 模擬 APK）
- 刪除 flutter_app/（已轉移至獨立 pikGPS repo）
- .gitignore 補上 .venv/

Android 完整快照保留於 archive/android-ios-mixed tag 與
archive/android-mixed 分支。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 2.7：驗證 commit**

Run: `git show --stat HEAD | head -20`
Expected：看到 `appium-settings.apk` 與多個 `flutter_app/` 檔案被刪除。

---

## Task 3：server.js 與 start.js iOS-only 化

**Files:**
- Modify: `server.js`（重寫多處 Android 相關段落）
- Modify: `start.js`（移除互動式選單）

### Task 3a：server.js 重寫

- [ ] **Step 3a.1：重寫 server.js 全文**

將 `server.js` 完整內容替換為：

```javascript
const express = require('express');
const { exec, spawn } = require('child_process');
const path = require('path');

// venv 執行檔路徑（Python 3.13 + pymobiledevice3）
const VENV_PYTHON = path.join(__dirname, '.venv', 'bin', 'python3');
const VENV_PMD3   = path.join(__dirname, '.venv', 'bin', 'pymobiledevice3');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 路徑播放狀態
let routeTimer = null;
let routeCurrentPos = null; // { lat, lng } 播放中的當前座標
let routePaused = false;    // 是否暫停中
let _routeState = null;     // 暫停 / 恢復時保存的播放細節

// 所有已偵測到的 iOS 裝置清單
let detectedDevices = [];  // [{ id, name, connection: 'usb' | 'wifi' }]
let selectedDeviceId = null;

// iOS DVT 常駐程式（ios_location_daemon.py 子進程）
let iosProcess = null;
let iosDaemonReady = false;
let iosDaemonError = null;  // 最新錯誤訊息（null 表示無錯誤）

// GPS Keepalive 狀態：定時重送最後一個座標，防止手機回到真實位置
let lastLocation = null;    // { lat, lng }
let keepaliveTimer = null;
const KEEPALIVE_MS = 2000;

// 計算兩點間距離（公尺），使用 Haversine 公式
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 啟動 iOS DVT 常駐程式
function startIosDaemon() {
  stopIosDaemon();
  iosDaemonError = null;
  const daemonPath = path.join(__dirname, 'ios_location_daemon.py');
  iosProcess = spawn(VENV_PYTHON, [daemonPath], { stdio: ['pipe', 'pipe', 'pipe'] });
  iosDaemonReady = false;

  iosProcess.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg.includes('READY')) iosDaemonReady = true;
  });
  iosProcess.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    console.error('[ios-daemon]', msg);
    // 偵測已知嚴重錯誤，通知前端需重啟伺服器
    if (msg.includes('Channel is closed') || msg.includes('設定位置失敗')) {
      iosDaemonError = 'channel_closed';
      iosDaemonReady = false;
    }
  });
  iosProcess.on('close', () => {
    iosProcess = null;
    iosDaemonReady = false;
  });
}

// 停止 iOS DVT 常駐程式
function stopIosDaemon() {
  if (iosProcess) {
    iosProcess.kill('SIGTERM');
    iosProcess = null;
  }
  iosDaemonReady = false;
  iosDaemonError = null;
}

// 啟動指定裝置（iOS-only：直接確保 daemon 在執行）
function activateDevice(device) {
  selectedDeviceId = device.id;
  if (!iosProcess) startIosDaemon();
}

// 執行送座標（iOS daemon stdin）
function sendLocation(lat, lng) {
  if (!isFinite(lat) || !isFinite(lng)) return;
  if (iosProcess && iosDaemonReady) {
    iosProcess.stdin.write(`${lat},${lng}\n`);
  }
}

// 啟動 keepalive：儲存座標並定時重送
function startKeepalive(lat, lng) {
  lastLocation = { lat, lng };
  if (keepaliveTimer) clearInterval(keepaliveTimer);
  keepaliveTimer = setInterval(() => {
    if (lastLocation) sendLocation(lastLocation.lat, lastLocation.lng);
  }, KEEPALIVE_MS);
}

// 停止 keepalive（不清除 lastLocation，以便之後可恢復）
function stopKeepalive() {
  if (keepaliveTimer) { clearInterval(keepaliveTimer); keepaliveTimer = null; }
}

// 隨機數工具：min ~ max 之間的浮點數
function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

// 模擬 GPS 抖動：在座標上加入隨機偏移（公尺轉經緯度）
function addGpsJitter(lat, lng, maxMeters) {
  const R = 6371000;
  const jitterLat = randomBetween(-maxMeters, maxMeters);
  const jitterLng = randomBetween(-maxMeters, maxMeters);
  const dLat = (jitterLat / R) * (180 / Math.PI);
  const dLng = (jitterLng / (R * Math.cos(lat * Math.PI / 180))) * (180 / Math.PI);
  return { lat: lat + dLat, lng: lng + dLng };
}

// 取得目前已選裝置資訊（精簡版，供相容用）
app.get('/api/device', (req, res) => {
  if (!selectedDeviceId) return res.json({ device: null });
  const d = detectedDevices.find(x => x.id === selectedDeviceId);
  if (!d) return res.json({ device: null });
  res.json({ device: d.name, connection: d.connection ?? null });
});

// 偵測所有可用 iOS 裝置（USB + WiFi）
app.get('/api/devices', (req, res) => {
  const result = [];

  // 偵測 iOS USB
  exec(`"${VENV_PMD3}" usbmux list`, (usbErr, usbOut) => {
    let usbDevices = [];
    if (!usbErr && usbOut?.trim() && usbOut.trim() !== '[]') {
      try { usbDevices = JSON.parse(usbOut); } catch {}
    }
    usbDevices.forEach(d => {
      const udid = d.UniqueDeviceID || d.udid || '';
      if (!udid || result.find(x => x.id === udid)) return;
      result.push({ id: udid, name: d.DeviceName || 'iOS Device', connection: 'usb' });
    });

    // 偵測 iOS WiFi（透過 tunneld）
    const listPath = path.join(__dirname, 'ios_list_devices.py');
    exec(`"${VENV_PYTHON}" "${listPath}"`, (wifiErr, wifiOut) => {
      if (!wifiErr && wifiOut?.trim() && wifiOut.trim() !== '[]') {
        try {
          const wifiDevices = JSON.parse(wifiOut);
          wifiDevices.forEach(d => {
            const udid = d.UniqueDeviceID || '';
            // 若已以 USB 列出則跳過
            if (udid && result.find(x => x.id === udid)) return;
            const wifiId = udid ? `${udid}-wifi` : `ios-wifi-${Date.now()}`;
            result.push({ id: wifiId, name: d.DeviceName || 'iOS Device', connection: 'wifi' });
          });
        } catch {}
      }

      detectedDevices = result;

      // 只有一台裝置且尚未選擇時自動啟動
      if (result.length === 1 && !selectedDeviceId) {
        activateDevice(result[0]);
      }
      // 若已選裝置已消失，清除狀態
      if (selectedDeviceId && !result.find(d => d.id === selectedDeviceId)) {
        selectedDeviceId = null;
        stopKeepalive();
        stopIosDaemon();
      }

      res.json({ devices: result, selectedId: selectedDeviceId });
    });
  });
});

// 選擇要發送訊號的裝置
app.post('/api/device/select', (req, res) => {
  const { id } = req.body;
  if (typeof id !== 'string' || !id) {
    return res.json({ success: false, error: '需要提供裝置 id' });
  }
  const device = detectedDevices.find(d => d.id === id);
  if (!device) {
    return res.json({ success: false, error: '裝置不存在，請先重新整理裝置清單' });
  }
  activateDevice(device);
  res.json({ success: true });
});

// 送出單一座標
app.post('/api/location', (req, res) => {
  const { lat, lng } = req.body;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.json({ success: false, error: '無效的座標' });
  }
  if (!isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.json({ success: false, error: '座標超出有效範圍（lat: -90~90, lng: -180~180）' });
  }
  if (!iosProcess || !iosDaemonReady) {
    return res.json({ success: false, error: '尚未連接裝置' });
  }
  sendLocation(lat, lng);
  startKeepalive(lat, lng);
  res.json({ success: true });
});

// =============================================
// 路徑播放核心 tick（使用模組層級狀態，支援暫停/恢復）
// =============================================
function _routeTick() {
  const state = _routeState;
  if (!state) return;

  const { waypoints, speedConfig } = state;
  const { baseStepMeters, GPS_JITTER_METERS, SPEED_VARIANCE, INTERVAL_VARIANCE, BASE_INTERVAL_MS } = speedConfig;

  if (state.segIndex >= waypoints.length - 1) {
    const endJittered = addGpsJitter(
      waypoints[waypoints.length - 1].lat,
      waypoints[waypoints.length - 1].lng,
      GPS_JITTER_METERS
    );
    sendLocation(endJittered.lat, endJittered.lng);
    routeCurrentPos = { lat: endJittered.lat, lng: endJittered.lng };
    startKeepalive(endJittered.lat, endJittered.lng);
    routeTimer = null;
    _routeState = null;
    return;
  }

  const speedFactor = randomBetween(1 - SPEED_VARIANCE, 1 + SPEED_VARIANCE);
  state.progress += baseStepMeters * speedFactor;

  while (state.segIndex < waypoints.length - 1) {
    const segDist = haversineDistance(
      waypoints[state.segIndex].lat, waypoints[state.segIndex].lng,
      waypoints[state.segIndex + 1].lat, waypoints[state.segIndex + 1].lng
    );
    if (segDist === 0) { state.segIndex++; continue; }
    if (state.progress >= segDist) {
      state.progress -= segDist;
      state.segIndex++;
      if (state.segIndex >= waypoints.length - 1) {
        const endJittered = addGpsJitter(
          waypoints[waypoints.length - 1].lat,
          waypoints[waypoints.length - 1].lng,
          GPS_JITTER_METERS
        );
        sendLocation(endJittered.lat, endJittered.lng);
        routeCurrentPos = { lat: endJittered.lat, lng: endJittered.lng };
        routeTimer = null;
        _routeState = null;
        startKeepalive(endJittered.lat, endJittered.lng);
        return;
      }
    } else {
      break;
    }
  }

  if (state.segIndex >= waypoints.length - 1) {
    if (routeCurrentPos) startKeepalive(routeCurrentPos.lat, routeCurrentPos.lng);
    routeTimer = null;
    _routeState = null;
    return;
  }

  const segDist = haversineDistance(
    waypoints[state.segIndex].lat, waypoints[state.segIndex].lng,
    waypoints[state.segIndex + 1].lat, waypoints[state.segIndex + 1].lng
  );
  const t = segDist > 0 ? state.progress / segDist : 0;
  const lat = waypoints[state.segIndex].lat + t * (waypoints[state.segIndex + 1].lat - waypoints[state.segIndex].lat);
  const lng = waypoints[state.segIndex].lng + t * (waypoints[state.segIndex + 1].lng - waypoints[state.segIndex].lng);

  const jittered = addGpsJitter(lat, lng, GPS_JITTER_METERS);
  sendLocation(jittered.lat, jittered.lng);
  routeCurrentPos = { lat: jittered.lat, lng: jittered.lng };

  const intervalFactor = randomBetween(1 - INTERVAL_VARIANCE, 1 + INTERVAL_VARIANCE);
  routeTimer = setTimeout(_routeTick, Math.round(BASE_INTERVAL_MS * intervalFactor));
}

app.post('/api/route/start', (req, res) => {
  const { waypoints, speed_kmh } = req.body;
  if (!Array.isArray(waypoints) || waypoints.length < 2) {
    return res.json({ success: false, error: '至少需要 2 個航點' });
  }
  for (const wp of waypoints) {
    if (typeof wp.lat !== 'number' || typeof wp.lng !== 'number' ||
        !isFinite(wp.lat) || !isFinite(wp.lng) ||
        wp.lat < -90 || wp.lat > 90 || wp.lng < -180 || wp.lng > 180) {
      return res.json({ success: false, error: '航點座標無效或超出範圍' });
    }
  }
  if (typeof speed_kmh !== 'number' || speed_kmh <= 0) {
    return res.json({ success: false, error: '速度必須為正數' });
  }

  stopKeepalive();
  if (routeTimer) { clearTimeout(routeTimer); routeTimer = null; }

  const BASE_INTERVAL_MS = 500;
  const speedMs = (speed_kmh * 1000) / 3600;
  const speedConfig = {
    baseStepMeters: speedMs * (BASE_INTERVAL_MS / 1000),
    GPS_JITTER_METERS: 2,
    SPEED_VARIANCE: 0.25,
    INTERVAL_VARIANCE: 0.2,
    BASE_INTERVAL_MS,
  };

  _routeState = { waypoints, segIndex: 0, progress: 0, speedConfig };
  routePaused = false;

  // 先送出起點
  const startJittered = addGpsJitter(waypoints[0].lat, waypoints[0].lng, speedConfig.GPS_JITTER_METERS);
  sendLocation(startJittered.lat, startJittered.lng);
  routeCurrentPos = { lat: startJittered.lat, lng: startJittered.lng };

  const firstInterval = Math.round(BASE_INTERVAL_MS * randomBetween(0.8, 1.2));
  routeTimer = setTimeout(_routeTick, firstInterval);

  res.json({ success: true });
});

app.post('/api/route/pause', (req, res) => {
  if (!routeTimer) return res.json({ success: false, error: '目前沒有正在播放的路徑' });
  clearTimeout(routeTimer);
  routeTimer = null;
  routePaused = true;
  if (routeCurrentPos) startKeepalive(routeCurrentPos.lat, routeCurrentPos.lng);
  res.json({ success: true, currentPos: routeCurrentPos });
});

app.post('/api/route/resume', (req, res) => {
  if (!routePaused || !_routeState) return res.json({ success: false, error: '目前不在暫停狀態' });
  stopKeepalive();
  routePaused = false;
  const { BASE_INTERVAL_MS } = _routeState.speedConfig;
  const firstInterval = Math.round(BASE_INTERVAL_MS * randomBetween(0.8, 1.2));
  routeTimer = setTimeout(_routeTick, firstInterval);
  res.json({ success: true });
});

app.post('/api/route/stop', (req, res) => {
  if (routeTimer) { clearTimeout(routeTimer); routeTimer = null; }
  routePaused = false;
  const lastPos = routeCurrentPos;   // 清除前先保留
  if (routeCurrentPos) {
    startKeepalive(routeCurrentPos.lat, routeCurrentPos.lng);
    routeCurrentPos = null;
  }
  _routeState = null;
  res.json({ success: true, lastPos });
});

// 查詢路徑播放狀態
app.get('/api/route/status', (req, res) => {
  res.json({ playing: routeTimer !== null, paused: routePaused, currentPos: routeCurrentPos });
});

// 查詢伺服器與 iOS daemon 狀態
app.get('/api/status', (req, res) => {
  let iosState = 'idle';
  if (selectedDeviceId) {
    if (iosDaemonReady) iosState = 'ready';
    else if (iosProcess) iosState = 'connecting';
  }
  res.json({
    iosState,        // 'idle' | 'connecting' | 'ready'
    iosDaemonError,  // null | 'channel_closed'
  });
});

// 查詢 keepalive 狀態
app.get('/api/keepalive', (req, res) => {
  res.json({ active: keepaliveTimer !== null, location: lastLocation });
});

// 手動開啟 / 關閉 keepalive
app.post('/api/keepalive', (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    return res.json({ success: false, error: '需要 enabled: boolean' });
  }
  if (enabled) {
    if (!lastLocation) return res.json({ success: false, error: '尚無座標可鎖定，請先送出座標' });
    startKeepalive(lastLocation.lat, lastLocation.lng);
  } else {
    stopKeepalive();
  }
  res.json({ success: true, active: keepaliveTimer !== null });
});

const PORT = 3000;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
```

- [ ] **Step 3a.2：驗證 server.js 無 Android 殘留**

Run:
```bash
grep -niE 'android|adb|appium|currentDriver|androidSerial|androidSdk|useForegroundService' server.js
```
Expected：無輸出（exit code 1）。

- [ ] **Step 3a.3：node 語法檢查**

Run:
```bash
node --check server.js
```
Expected：無輸出（exit code 0）。

### Task 3b：start.js 重寫

- [ ] **Step 3b.1：重寫 start.js 全文**

將 `start.js` 完整內容替換為：

```javascript
#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

// venv 執行檔路徑（Python 3.13 + pymobiledevice3）
const VENV_PMD3 = path.join(__dirname, '.venv', 'bin', 'pymobiledevice3');

// 管理子程序，確保退出時一起清理
const children = [];
function spawnTracked(cmd, args, opts) {
  const child = spawn(cmd, args, opts);
  children.push(child);
  return child;
}

function cleanup() {
  for (const child of children) {
    try { child.kill('SIGTERM'); } catch {}
  }
}
process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });
process.on('exit', cleanup);

function startServer() {
  const server = spawnTracked('node', [path.join(__dirname, 'server.js')], {
    stdio: 'inherit',
  });
  server.on('close', (code) => {
    cleanup();
    process.exit(code ?? 0);
  });
}

async function startIosTunnel() {
  console.log('\n正在啟動 pymobiledevice3 通道（需要 sudo 權限）...');
  console.log('如果提示輸入密碼，請輸入您的 Mac 登入密碼。\n');

  const tunneld = spawnTracked('sudo', [VENV_PMD3, 'remote', 'tunneld'], {
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  return new Promise((resolve, reject) => {
    let started = false;

    // tunneld 就緒判斷：有任何 stdout 輸出或等待超時後直接啟動
    tunneld.stdout.on('data', (data) => {
      const msg = data.toString();
      process.stdout.write(`[tunneld] ${msg}`);
      if (!started) {
        started = true;
        resolve();
      }
    });

    tunneld.stderr.on('data', (data) => {
      const msg = data.toString();
      process.stderr.write(`[tunneld] ${msg}`);
      // 有些版本的 pymobiledevice3 會用 stderr 輸出啟動訊息
      if (!started) {
        started = true;
        resolve();
      }
    });

    tunneld.on('close', (code) => {
      if (!started) {
        reject(new Error(`tunneld 啟動失敗（exit code: ${code}）`));
      }
    });

    // 安全超時：如果 5 秒內沒有任何輸出，仍然繼續啟動伺服器
    setTimeout(() => {
      if (!started) {
        started = true;
        console.log('[tunneld] 等待超時，嘗試繼續啟動伺服器...');
        resolve();
      }
    }, 5000);
  });
}

async function main() {
  console.log('=== pikGPS 啟動器（iOS） ===\n');
  console.log('iOS 連線前請確認：');
  console.log('  · iPhone 已先用 USB 與 Mac 配對過（WiFi 連線需要）');
  console.log('  · iPhone 與 Mac 在同一個 WiFi 網路（WiFi 連線需要）');
  console.log('  · 設定 → 隱私權與安全性 → 開發者模式 已開啟');
  console.log('');

  try {
    await startIosTunnel();
    console.log('\n通道已啟動，正在啟動伺服器...\n');
  } catch (err) {
    console.error(`\n錯誤：${err.message}`);
    console.error('請確認已安裝 pymobiledevice3：pip3 install "pymobiledevice3>=9.6"');
    process.exit(1);
  }

  startServer();
}

main();
```

- [ ] **Step 3b.2：驗證 start.js 無 Android 殘留**

Run:
```bash
grep -niE 'android|adb|readline|ask\(' start.js
```
Expected：無輸出。

- [ ] **Step 3b.3：node 語法檢查**

Run:
```bash
node --check start.js
```
Expected：無輸出。

### Task 3c：commit

- [ ] **Step 3c.1：Commit**

```bash
git add server.js start.js
git commit -m "$(cat <<'EOF'
refactor: server.js 與 start.js 改為 iOS-only

- server.js: 移除 Android 雙驅動（currentDriver/adb/foreground service）
- server.js: 裝置物件移除 androidSerial/androidSdk/platform 欄位
- server.js: /api/devices 只偵測 iOS USB + WiFi
- server.js: /api/status 移除 driver 欄位
- start.js: 移除 Android/iOS 互動式選單，直接啟動 iOS tunnel + server

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3c.2：手動驗證可啟動**

Run（背景啟動，不需 sudo 也能至少跑 server 部分）：
```bash
node server.js &
SERVER_PID=$!
sleep 1
curl -s http://localhost:3000/api/status
kill $SERVER_PID
```
Expected：回傳 JSON `{"iosState":"idle","iosDaemonError":null}`，且無 `driver` 欄位。

---

## Task 4：前端 app.js 移除 Android 欄位/標籤

**Files:**
- Modify: `public/app.js`（兩處變動）

- [ ] **Step 4.1：移除 PLATFORM_LABELS 常數**

定位 `public/app.js` 中的這一行：
```javascript
const PLATFORM_LABELS   = { ios: ' (iOS)', android: ' (Android)' };
```

刪除整行。

- [ ] **Step 4.2：簡化 updateDeviceInfo() 中的 iOS 條件判斷**

定位 `public/app.js` 中的這段：
```javascript
  infoEl.style.color = '';
  let info = CONNECTION_LABELS[device.connection] ?? '';
  if (device.platform === 'ios') {
    const daemonLabel = { ready: '✓ DVT 已就緒', connecting: '⏳ DVT 連線中…', idle: '' };
    const daemon = daemonLabel[statusData.iosState] ?? '';
    if (daemon) info += (info ? '　' : '') + daemon;
  }
  infoEl.textContent = info;
```

替換為（移除 platform === 'ios' 判斷，直接顯示）：
```javascript
  infoEl.style.color = '';
  let info = CONNECTION_LABELS[device.connection] ?? '';
  const daemonLabel = { ready: '✓ DVT 已就緒', connecting: '⏳ DVT 連線中…', idle: '' };
  const daemon = daemonLabel[statusData.iosState] ?? '';
  if (daemon) info += (info ? '　' : '') + daemon;
  infoEl.textContent = info;
```

也要更新前一段的 channel_closed 判斷，移除 `device.platform === 'ios'` 檢查（iOS-only 後永遠是 iOS）：

定位：
```javascript
  // iOS daemon 發生 Channel is closed 等嚴重錯誤
  if (device.platform === 'ios' && statusData.iosDaemonError === 'channel_closed') {
```

替換為：
```javascript
  // iOS daemon 發生 Channel is closed 等嚴重錯誤
  if (statusData.iosDaemonError === 'channel_closed') {
```

- [ ] **Step 4.3：簡化 refreshDevice() 下拉選單 label**

定位 `public/app.js` 中的這段：
```javascript
    devices.forEach(d => {
      const connLabel = CONNECTION_LABELS[d.connection] ?? '';
      const platLabel = PLATFORM_LABELS[d.platform] ?? '';
      const label = `${d.name}${platLabel}${connLabel ? ' ' + connLabel : ''}`;
      selectEl.add(new Option(label, d.id));
    });
```

替換為：
```javascript
    devices.forEach(d => {
      const connLabel = CONNECTION_LABELS[d.connection] ?? '';
      const label = `${d.name}${connLabel ? ' ' + connLabel : ''}`;
      selectEl.add(new Option(label, d.id));
    });
```

- [ ] **Step 4.4：驗證 app.js 無 platform 殘留**

Run:
```bash
grep -nE 'PLATFORM_LABELS|device\.platform|androidSerial|androidSdk' public/app.js
```
Expected：無輸出。

- [ ] **Step 4.5：node 語法檢查**

Run:
```bash
node --check public/app.js
```
Expected：無輸出。

- [ ] **Step 4.6：Commit**

```bash
git add public/app.js
git commit -m "$(cat <<'EOF'
refactor: 前端移除 Android 平台欄位與標籤

- 移除 PLATFORM_LABELS 常數
- updateDeviceInfo() 移除 device.platform 條件判斷
- refreshDevice() 下拉選單 label 不再顯示 (iOS) / (Android) 後綴

iOS-only 後不再需要區分平台。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5：package.json 改名為 pikgps

**Files:**
- Modify: `package.json`

- [ ] **Step 5.1：重寫 package.json**

將 `package.json` 完整內容替換為：

```json
{
  "name": "pikgps",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node start.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "description": "iOS GPS 位置模擬控制台",
  "dependencies": {
    "express": "^5.2.1"
  }
}
```

（變動：`name` 改為 `pikgps`、`description` 補上、移除 `directories`）

- [ ] **Step 5.2：驗證 JSON 合法**

Run:
```bash
node -e "console.log(require('./package.json').name)"
```
Expected：`pikgps`

- [ ] **Step 5.3：Commit**

```bash
git add package.json
git commit -m "$(cat <<'EOF'
chore: package.json 改名為 pikgps

- name: android-fakegps → pikgps
- 補上 description: "iOS GPS 位置模擬控制台"
- 移除無作用的 directories 欄位

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6：文件全面重寫（README / quickinstall / tutor）

**Files:**
- Modify: `README.md`（重寫，移除所有 Android 章節）
- Modify: `quickinstall.md`（重寫成 iOS-only）
- Modify: `tutor.md`（重寫成 iOS-only）

> 此 task 較大，分成 3 個子 task 各自 commit 一次也可，但這裡採整批寫完再 commit（單一 commit 較利於 review 文件）。

### Task 6a：重寫 README.md

- [ ] **Step 6a.1：以下段落為 README.md 完整新內容（中文版）**

開啟 `README.md`，將 line 1 到 line 343（中文版部分，含尾端的 `---`）替換為以下內容：

```markdown
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
2. 確認位置後按「**✓ 改變定位**」→ 座標送出，紅色主標記移動
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

```

> 中文版到此結束（保留原本的 `---` 分隔線在最後一行）。

- [ ] **Step 6a.2：英文版同步重寫**

開啟 `README.md`，將 line 347 起的英文版（從 `# 🗺️ pikGPS Controller` 開始至檔案結尾）替換為以下內容：

```markdown
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
```

- [ ] **Step 6a.3：驗證 README.md 無 Android 殘留**

Run:
```bash
grep -niE 'android|adb|appium' README.md
```
Expected：無輸出。

### Task 6b：重寫 quickinstall.md

- [ ] **Step 6b.1：重寫 quickinstall.md 全文**

將 `quickinstall.md` 完整內容替換為：

```markdown
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
```

- [ ] **Step 6b.2：驗證 quickinstall.md 無 Android 殘留**

Run:
```bash
grep -niE 'android|adb|appium' quickinstall.md
```
Expected：無輸出。

### Task 6c：重寫 tutor.md

- [ ] **Step 6c.1：重寫 tutor.md 全文（iOS-only 新手教學）**

由於原本的 tutor.md 約 998 行且大量描述 Android 步驟，採完全替換策略。將 `tutor.md` 完整內容替換為：

```markdown
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
```

- [ ] **Step 6c.2：驗證 tutor.md 無 Android 殘留**

Run:
```bash
grep -niE 'android|adb|appium' tutor.md
```
Expected：無輸出。

### Task 6d：commit 文件變動

- [ ] **Step 6d.1：Commit**

```bash
git add README.md quickinstall.md tutor.md
git commit -m "$(cat <<'EOF'
docs: 重寫 README / quickinstall / tutor 為 iOS-only

完整移除 Android 相關章節（USB 偵錯、Appium Settings、模擬位置設定、
ADB 安裝等）。系統需求表整併為 iOS 前置安裝；架構圖移除 Android 分支；
常見問題整理為 iOS-only。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7：最終驗收

- [ ] **Step 7.1：全文搜尋確認無 Android 殘留**

Run:
```bash
grep -rinE 'android|adb|appium' \
  --include='*.js' --include='*.md' --include='*.json' --include='*.py' \
  --exclude-dir=node_modules --exclude-dir=.venv --exclude-dir=.git \
  --exclude-dir='docs/plans' \
  .
```
Expected：應無輸出，或僅出現於 `docs/superpowers/` 設計/計畫文件中（這些文件本身會描述 Android 移除過程，屬正常）。

> 若除了 superpowers/ 之外有命中，請逐一檢視並修正後重新 commit。

- [ ] **Step 7.2：確認 commit 數量正確**

Run:
```bash
git log --oneline master ^archive/android-mixed
```
Expected：應有 5 個新 commit（Task 2、3、4、5、6 各一個；Task 1 沒 commit 只動 ref）。

- [ ] **Step 7.3：確認 archive 仍可存取**

Run:
```bash
git show archive/android-ios-mixed --stat | head -5
```
Expected：顯示舊 commit（含 `flutter_app/` 與 `appium-settings.apk`）。

- [ ] **Step 7.4：手動執行驗證**

實際啟動並測試：

1. 啟動：
   ```bash
   npm start
   ```
   Expected：印出「=== pikGPS 啟動器（iOS） ===」，無 1/2 選單；tunneld 成功啟動或 5 秒超時後 server 啟動。

2. 在瀏覽器開啟 http://localhost:3000，確認：
   - 頁面標題為 pikGPS
   - 側邊欄裝置區塊正常呈現
   - 連接 iPhone 後可在下拉選單看到，標籤格式：`iPhone 名稱 📶 WiFi` 或 `iPhone 名稱 🔌 USB`（無 (iOS) 後綴）

3. 操作測試（需有 iPhone）：
   - 改變定位：搜尋地點 → 預覽 → 確認 → iPhone GPS 跳轉
   - Keepalive：等 10 秒，GPS 不漂移
   - 路徑播放：加 2 個航點 → ▶ 開始 → 標記移動
   - GPX 載入：選一個 .gpx 檔 → 自動填入航點

- [ ] **Step 7.5：（選擇性）推送 master 至 origin**

> 確認所有 commit 與測試都 OK 後，使用者自行決定是否推送。本計畫不自動推送。

```bash
git push origin master
```

---

## 完工標準

✅ Task 1–6 全部 commit 成功
✅ `git tag` 顯示 `archive/android-ios-mixed`，遠端也有
✅ `git branch` 顯示 `archive/android-mixed`，遠端也有
✅ `npm start` 直接啟動 iOS tunnel + server，無互動式選單
✅ 連接 iPhone（USB / WiFi）後前端能正確偵測與切換
✅ 改變定位、keepalive、路徑播放、GPX 載入皆運作正常
✅ 全文搜尋 `android`/`adb`/`appium`（排除 archive、docs/plans、docs/superpowers）應無命中
✅ `package.json` name 為 `pikgps`
✅ README / quickinstall / tutor 無 Android 章節
