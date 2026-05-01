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
