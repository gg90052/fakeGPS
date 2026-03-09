# Android Fake GPS 網頁工具 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 建立一個本地 Node.js Web App，透過 Google Maps 介面讓使用者點選 GPS 座標，並透過 ADB 送給 Android 手機的 Appium Settings 模擬假位置。

**Architecture:** Express 後端提供靜態檔案與 3 個 API endpoints，前端純 HTML/CSS/JS 搭配 Google Maps API，後端用 `child_process.exec` 執行 adb 指令，路徑播放透過後端 `setInterval` 做插值。

**Tech Stack:** Node.js, Express, Google Maps JavaScript API, adb (child_process)

---

### Task 1: 初始化專案

**Files:**
- Create: `package.json`
- Create: `server.js`

**Step 1: 初始化 npm 專案**

```bash
cd /Users/teddyhuang/Documents/teddy/android-fakegps
npm init -y
```

**Step 2: 安裝 Express**

```bash
npm install express
```

**Step 3: 建立基本 server.js**

```javascript
const express = require('express');
const { exec } = require('child_process');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
```

**Step 4: 建立 public 目錄與空白 index.html**

```bash
mkdir -p public
touch public/index.html public/style.css public/app.js
```

**Step 5: 驗證 server 啟動正常**

```bash
node server.js
# 預期輸出：Server running at http://localhost:3000
# Ctrl+C 停止
```

**Step 6: Commit**

```bash
git init
git add package.json package-lock.json server.js public/
git commit -m "初始化專案：Express server 架構"
```

---

### Task 2: 後端 API — POST /api/location

**Files:**
- Modify: `server.js`

**Step 1: 在 server.js 加入 /api/location endpoint**

在 `app.listen` 之前加入：

```javascript
// 送出單一座標
app.post('/api/location', (req, res) => {
  const { lat, lng } = req.body;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.json({ success: false, error: '無效的座標' });
  }
  const cmd = `adb shell am startservice -n io.appium.settings/.LocationService --es longitude "${lng}" --es latitude "${lat}"`;
  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      return res.json({ success: false, error: error.message });
    }
    res.json({ success: true });
  });
});
```

**Step 2: 手動測試 endpoint**

啟動 server 後用 curl 測試：
```bash
node server.js &
curl -X POST http://localhost:3000/api/location \
  -H "Content-Type: application/json" \
  -d '{"lat": 25.0478, "lng": 121.5319}'
# 預期：{"success":true} 或 {"success":false,"error":"..."}（沒接手機也 OK，看到 JSON 回應就對了）
kill %1
```

**Step 3: Commit**

```bash
git add server.js
git commit -m "後端：新增 POST /api/location endpoint"
```

---

### Task 3: 後端 API — 路徑播放（/api/route/start、/api/route/stop）

**Files:**
- Modify: `server.js`

**Step 1: 加入路徑播放狀態與輔助函式**

在 `app.use(express.json())` 之後加入：

```javascript
// 路徑播放狀態
let routeTimer = null;

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

// 執行 adb 送座標（不等回應）
function sendLocation(lat, lng) {
  const cmd = `adb shell am startservice -n io.appium.settings/.LocationService --es longitude "${lng}" --es latitude "${lat}"`;
  exec(cmd, () => {});
}
```

**Step 2: 加入 /api/route/start endpoint**

```javascript
app.post('/api/route/start', (req, res) => {
  const { waypoints, speed_kmh } = req.body;
  if (!Array.isArray(waypoints) || waypoints.length < 2) {
    return res.json({ success: false, error: '至少需要 2 個航點' });
  }
  if (routeTimer) clearInterval(routeTimer);

  const INTERVAL_MS = 500;
  const speedMs = (speed_kmh * 1000) / 3600; // 公尺/秒
  const stepMeters = speedMs * (INTERVAL_MS / 1000); // 每次移動距離

  let segIndex = 0;
  let progress = 0; // 在當前線段上已走的公尺

  routeTimer = setInterval(() => {
    if (segIndex >= waypoints.length - 1) {
      clearInterval(routeTimer);
      routeTimer = null;
      return;
    }
    const from = waypoints[segIndex];
    const to = waypoints[segIndex + 1];
    const segDist = haversineDistance(from.lat, from.lng, to.lat, to.lng);

    progress += stepMeters;

    while (progress >= segDist && segIndex < waypoints.length - 1) {
      progress -= segDist;
      segIndex++;
      if (segIndex >= waypoints.length - 1) {
        sendLocation(waypoints[waypoints.length - 1].lat, waypoints[waypoints.length - 1].lng);
        clearInterval(routeTimer);
        routeTimer = null;
        return;
      }
    }

    if (segIndex >= waypoints.length - 1) return;
    const t = progress / haversineDistance(
      waypoints[segIndex].lat, waypoints[segIndex].lng,
      waypoints[segIndex + 1].lat, waypoints[segIndex + 1].lng
    );
    const lat = waypoints[segIndex].lat + t * (waypoints[segIndex + 1].lat - waypoints[segIndex].lat);
    const lng = waypoints[segIndex].lng + t * (waypoints[segIndex + 1].lng - waypoints[segIndex].lng);
    sendLocation(lat, lng);
  }, INTERVAL_MS);

  res.json({ success: true });
});
```

**Step 3: 加入 /api/route/stop endpoint**

```javascript
app.post('/api/route/stop', (req, res) => {
  if (routeTimer) {
    clearInterval(routeTimer);
    routeTimer = null;
  }
  res.json({ success: true });
});
```

**Step 4: 手動測試 stop endpoint**

```bash
node server.js &
curl -X POST http://localhost:3000/api/route/stop
# 預期：{"success":true}
kill %1
```

**Step 5: Commit**

```bash
git add server.js
git commit -m "後端：新增路徑播放 API（start/stop）與 Haversine 插值"
```

---

### Task 4: 前端 HTML 骨架

**Files:**
- Modify: `public/index.html`

**Step 1: 撰寫 index.html**

> 注意：將 `YOUR_GOOGLE_MAPS_API_KEY` 替換成你的實際 API Key。

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Android Fake GPS</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div id="sidebar">
    <h2>Fake GPS 控制台</h2>

    <!-- 裝置狀態 -->
    <section>
      <label>ADB 裝置</label>
      <div id="device-status">未偵測</div>
      <button id="btn-refresh-device">重新整理</button>
    </section>

    <!-- 座標輸入 -->
    <section>
      <label>緯度 (Latitude)</label>
      <input type="number" id="input-lat" step="0.000001" placeholder="25.0478" />
      <label>經度 (Longitude)</label>
      <input type="number" id="input-lng" step="0.000001" placeholder="121.5319" />
      <button id="btn-send-location">送出座標</button>
    </section>

    <!-- 方向按鈕 -->
    <section>
      <label>微調距離（公尺）</label>
      <input type="number" id="input-step" value="10" min="1" max="1000" />
      <div id="dpad">
        <button id="btn-up">↑</button>
        <div>
          <button id="btn-left">←</button>
          <button id="btn-down">↓</button>
          <button id="btn-right">→</button>
        </div>
      </div>
    </section>

    <!-- 路徑規劃 -->
    <section>
      <label>路徑規劃</label>
      <div id="waypoint-mode-hint">在地圖上點擊新增航點（先開啟模式）</div>
      <button id="btn-toggle-waypoint-mode">開啟航點模式</button>
      <ul id="waypoint-list"></ul>
      <label>速度（km/h）</label>
      <input type="range" id="speed-slider" min="1" max="50" value="10" />
      <span id="speed-display">10 km/h</span>
      <div>
        <button id="btn-route-start" disabled>▶ 開始播放</button>
        <button id="btn-route-stop" disabled>■ 停止</button>
        <button id="btn-route-clear">清除航點</button>
      </div>
    </section>

    <!-- 狀態訊息 -->
    <div id="status-msg"></div>
  </div>

  <div id="map"></div>

  <script src="app.js"></script>
  <script
    src="https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_MAPS_API_KEY&callback=initMap"
    async defer
  ></script>
</body>
</html>
```

**Step 2: Commit**

```bash
git add public/index.html
git commit -m "前端：HTML 骨架與控制面板結構"
```

---

### Task 5: 前端 CSS 樣式

**Files:**
- Modify: `public/style.css`

**Step 1: 撰寫 style.css**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  display: flex;
  height: 100vh;
  font-family: system-ui, sans-serif;
  font-size: 14px;
}

#sidebar {
  width: 280px;
  min-width: 280px;
  height: 100vh;
  overflow-y: auto;
  padding: 16px;
  background: #1e1e2e;
  color: #cdd6f4;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

#sidebar h2 {
  font-size: 16px;
  color: #cba6f7;
  margin-bottom: 4px;
}

section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  background: #313244;
  border-radius: 8px;
}

label { font-size: 12px; color: #a6adc8; }

input[type="number"], input[type="range"] {
  width: 100%;
  padding: 6px 8px;
  background: #45475a;
  border: 1px solid #585b70;
  border-radius: 4px;
  color: #cdd6f4;
  font-size: 13px;
}

button {
  padding: 7px 12px;
  background: #89b4fa;
  color: #1e1e2e;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
}

button:disabled {
  background: #45475a;
  color: #585b70;
  cursor: not-allowed;
}

button:hover:not(:disabled) { background: #b4d0fb; }

#device-status {
  font-size: 12px;
  color: #a6e3a1;
  background: #1e1e2e;
  padding: 4px 8px;
  border-radius: 4px;
}

/* D-Pad */
#dpad { display: flex; flex-direction: column; align-items: center; gap: 4px; }
#dpad div { display: flex; gap: 4px; }
#dpad button { width: 40px; height: 40px; font-size: 16px; padding: 0; }

/* 航點清單 */
#waypoint-list { list-style: none; display: flex; flex-direction: column; gap: 4px; }
#waypoint-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #1e1e2e;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}
#waypoint-list li button {
  padding: 2px 6px;
  background: #f38ba8;
  font-size: 11px;
}

#speed-display { font-size: 12px; color: #89b4fa; }

#status-msg {
  font-size: 12px;
  color: #a6e3a1;
  min-height: 20px;
  text-align: center;
}

#map { flex: 1; height: 100vh; }
```

**Step 2: Commit**

```bash
git add public/style.css
git commit -m "前端：Catppuccin 主題 CSS 樣式"
```

---

### Task 6: 前端 JavaScript — Google Maps 初始化與座標連動

**Files:**
- Modify: `public/app.js`

**Step 1: 撰寫 app.js 基礎結構與 Google Maps 初始化**

```javascript
// 全域狀態
let map, marker;
let waypoints = [];
let waypointMarkers = [];
let waypointMode = false;

// 工具函式：顯示狀態訊息
function showStatus(msg, isError = false) {
  const el = document.getElementById('status-msg');
  el.textContent = msg;
  el.style.color = isError ? '#f38ba8' : '#a6e3a1';
  setTimeout(() => { el.textContent = ''; }, 3000);
}

// 送出座標到後端
async function sendLocation(lat, lng) {
  try {
    const res = await fetch('/api/location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng }),
    });
    const data = await res.json();
    if (data.success) {
      showStatus(`✓ 座標已送出：${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    } else {
      showStatus(`✗ 錯誤：${data.error}`, true);
    }
  } catch (e) {
    showStatus(`✗ 網路錯誤：${e.message}`, true);
  }
}

// 更新輸入框與地圖 pin
function setLocation(lat, lng, sendAdb = true) {
  document.getElementById('input-lat').value = lat.toFixed(6);
  document.getElementById('input-lng').value = lng.toFixed(6);
  const pos = { lat, lng };
  if (marker) {
    marker.setPosition(pos);
  } else {
    marker = new google.maps.Marker({ position: pos, map, title: 'Current Location' });
  }
  map.panTo(pos);
  if (sendAdb) sendLocation(lat, lng);
}

// Google Maps 初始化（由 script tag callback 呼叫）
function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 25.0478, lng: 121.5319 },
    zoom: 15,
  });

  // 點擊地圖
  map.addListener('click', (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    if (waypointMode) {
      addWaypoint(lat, lng);
    } else {
      setLocation(lat, lng, true);
    }
  });

  setupControls();
}
```

**Step 2: Commit**

```bash
git add public/app.js
git commit -m "前端：Google Maps 初始化與座標連動邏輯"
```

---

### Task 7: 前端 JavaScript — 控制面板互動

**Files:**
- Modify: `public/app.js`

**Step 1: 加入 setupControls 函式（接在 Task 6 程式碼之後）**

```javascript
function setupControls() {
  // 送出座標按鈕
  document.getElementById('btn-send-location').addEventListener('click', () => {
    const lat = parseFloat(document.getElementById('input-lat').value);
    const lng = parseFloat(document.getElementById('input-lng').value);
    if (isNaN(lat) || isNaN(lng)) return showStatus('請輸入有效座標', true);
    setLocation(lat, lng, true);
  });

  // 輸入框 Enter 送出
  ['input-lat', 'input-lng'].forEach((id) => {
    document.getElementById(id).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btn-send-location').click();
    });
  });

  // 裝置狀態刷新
  document.getElementById('btn-refresh-device').addEventListener('click', refreshDevice);
  refreshDevice();

  // D-Pad 方向按鈕
  const EARTH_R = 6371000;
  function moveLocation(dLat, dLng) {
    const lat = parseFloat(document.getElementById('input-lat').value) || 25.0478;
    const lng = parseFloat(document.getElementById('input-lng').value) || 121.5319;
    const step = parseFloat(document.getElementById('input-step').value) || 10;
    const newLat = lat + (dLat * step / EARTH_R) * (180 / Math.PI);
    const newLng = lng + (dLng * step / (EARTH_R * Math.cos(lat * Math.PI / 180))) * (180 / Math.PI);
    setLocation(newLat, newLng, true);
  }

  document.getElementById('btn-up').addEventListener('click', () => moveLocation(1, 0));
  document.getElementById('btn-down').addEventListener('click', () => moveLocation(-1, 0));
  document.getElementById('btn-left').addEventListener('click', () => moveLocation(0, -1));
  document.getElementById('btn-right').addEventListener('click', () => moveLocation(0, 1));

  // 速度滑桿
  const speedSlider = document.getElementById('speed-slider');
  speedSlider.addEventListener('input', () => {
    document.getElementById('speed-display').textContent = `${speedSlider.value} km/h`;
  });

  // 路徑播放按鈕
  document.getElementById('btn-route-start').addEventListener('click', startRoute);
  document.getElementById('btn-route-stop').addEventListener('click', stopRoute);
  document.getElementById('btn-route-clear').addEventListener('click', clearWaypoints);
  document.getElementById('btn-toggle-waypoint-mode').addEventListener('click', toggleWaypointMode);
}

// 刷新 ADB 裝置狀態
async function refreshDevice() {
  try {
    const res = await fetch('/api/device');
    const data = await res.json();
    document.getElementById('device-status').textContent = data.device || '未偵測';
  } catch {
    document.getElementById('device-status').textContent = '無法連線到後端';
  }
}
```

**Step 2: 加入 /api/device endpoint 到 server.js**

```javascript
// 取得 ADB 裝置名稱
app.get('/api/device', (req, res) => {
  exec('adb devices', (error, stdout) => {
    if (error) return res.json({ device: null });
    const lines = stdout.trim().split('\n').slice(1).filter((l) => l.includes('\tdevice'));
    const device = lines.length > 0 ? lines[0].split('\t')[0] : null;
    res.json({ device });
  });
});
```

**Step 3: Commit**

```bash
git add public/app.js server.js
git commit -m "前端：控制面板互動（D-Pad、座標輸入、裝置狀態）"
```

---

### Task 8: 前端 JavaScript — 路徑規劃功能

**Files:**
- Modify: `public/app.js`

**Step 1: 加入航點管理函式（接在 setupControls 之後）**

```javascript
// 切換航點模式
function toggleWaypointMode() {
  waypointMode = !waypointMode;
  const btn = document.getElementById('btn-toggle-waypoint-mode');
  btn.textContent = waypointMode ? '關閉航點模式' : '開啟航點模式';
  btn.style.background = waypointMode ? '#a6e3a1' : '';
  document.getElementById('waypoint-mode-hint').textContent = waypointMode
    ? '點擊地圖新增航點'
    : '在地圖上點擊新增航點（先開啟模式）';
}

// 新增航點
function addWaypoint(lat, lng) {
  waypoints.push({ lat, lng });
  // 在地圖上放小標記
  const marker = new google.maps.Marker({
    position: { lat, lng },
    map,
    label: String(waypoints.length),
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 8,
      fillColor: '#cba6f7',
      fillOpacity: 1,
      strokeColor: '#1e1e2e',
      strokeWeight: 2,
    },
  });
  waypointMarkers.push(marker);
  renderWaypointList();
  // 有 2 個以上航點才可播放
  document.getElementById('btn-route-start').disabled = waypoints.length < 2;
}

// 刪除單一航點
function removeWaypoint(index) {
  waypoints.splice(index, 1);
  waypointMarkers[index].setMap(null);
  waypointMarkers.splice(index, 1);
  // 重新標號
  waypointMarkers.forEach((m, i) => m.setLabel(String(i + 1)));
  renderWaypointList();
  document.getElementById('btn-route-start').disabled = waypoints.length < 2;
}

// 清除所有航點
function clearWaypoints() {
  waypoints = [];
  waypointMarkers.forEach((m) => m.setMap(null));
  waypointMarkers = [];
  renderWaypointList();
  document.getElementById('btn-route-start').disabled = true;
}

// 渲染航點清單
function renderWaypointList() {
  const list = document.getElementById('waypoint-list');
  list.innerHTML = '';
  waypoints.forEach((wp, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${i + 1}. ${wp.lat.toFixed(5)}, ${wp.lng.toFixed(5)}</span>`;
    const del = document.createElement('button');
    del.textContent = '✕';
    del.addEventListener('click', () => removeWaypoint(i));
    li.appendChild(del);
    list.appendChild(li);
  });
}

// 開始路徑播放
async function startRoute() {
  if (waypoints.length < 2) return showStatus('至少需要 2 個航點', true);
  const speed_kmh = parseInt(document.getElementById('speed-slider').value, 10);
  try {
    const res = await fetch('/api/route/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ waypoints, speed_kmh }),
    });
    const data = await res.json();
    if (data.success) {
      showStatus('▶ 路徑播放中...');
      document.getElementById('btn-route-start').disabled = true;
      document.getElementById('btn-route-stop').disabled = false;
    } else {
      showStatus(`✗ ${data.error}`, true);
    }
  } catch (e) {
    showStatus(`✗ ${e.message}`, true);
  }
}

// 停止路徑播放
async function stopRoute() {
  await fetch('/api/route/stop', { method: 'POST' });
  showStatus('■ 路徑播放已停止');
  document.getElementById('btn-route-start').disabled = waypoints.length < 2;
  document.getElementById('btn-route-stop').disabled = true;
}
```

**Step 2: Commit**

```bash
git add public/app.js
git commit -m "前端：路徑規劃功能（航點管理、播放控制）"
```

---

### Task 9: 完整測試

**Step 1: 確認 index.html 的 Google Maps API Key 已填入**

開啟 `public/index.html`，將 `YOUR_GOOGLE_MAPS_API_KEY` 替換成你的實際 API Key。

**Step 2: 啟動 server**

```bash
node server.js
# 預期：Server running at http://localhost:3000
```

**Step 3: 手動測試清單**

開啟瀏覽器 `http://localhost:3000`，逐項確認：

- [ ] 地圖正常載入
- [ ] 點擊地圖，pin 移動，輸入框更新
- [ ] 在輸入框輸入座標按 Enter，地圖 pin 移動
- [ ] D-Pad 按鈕可微調位置
- [ ] 開啟航點模式，點地圖新增多個航點，清單顯示正確
- [ ] 刪除單一航點，清單更新，地圖標記消失
- [ ] 設定速度後開始播放，console 無錯誤
- [ ] 停止播放正常
- [ ] 清除航點正常

（若有連接 Android 手機，可驗證手機 GPS 位置是否確實改變）

**Step 4: 最終 Commit**

```bash
git add .
git commit -m "完成：Android Fake GPS 網頁工具"
```

---

## 快速啟動參考

```bash
cd /Users/teddyhuang/Documents/teddy/android-fakegps
npm install
node server.js
# 瀏覽器開 http://localhost:3000
```

記得在 `public/index.html` 填入你的 Google Maps API Key。
