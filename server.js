const express = require('express');
// exec 將用於執行 adb shell 指令（Task 2 起使用）
const { exec } = require('child_process');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 路徑播放狀態
let routeTimer = null;
let routeCurrentPos = null; // { lat, lng } 播放中的當前座標

// Android 版本自動偵測：Android 8+（API 26+）需使用 start-foreground-service
let useForegroundService = false;

// 裝置驅動類型：'android' | 'ios' | null
let currentDriver = null;

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

// 執行送座標（根據裝置類型選擇驅動）
function sendLocation(lat, lng) {
  if (!isFinite(lat) || !isFinite(lng)) return;
  let cmd;
  if (currentDriver === 'android') {
    const svcCmd = useForegroundService ? 'start-foreground-service' : 'startservice';
    cmd = `adb shell am ${svcCmd} -n io.appium.settings/.LocationService --es longitude "${lng}" --es latitude "${lat}"`;
  } else if (currentDriver === 'ios') {
    cmd = `pymobiledevice3 developer simulate-location set -- "${lat}" "${lng}"`;
  }
  if (cmd) exec(cmd, () => {});
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

// 偵測 ADB 連線裝置，並自動偵測 Android 版本決定 service 指令
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
      if (iosError || !iosStdout?.trim() || iosStdout.trim() === '[]') {
        currentDriver = null;
        stopKeepalive();
        return res.json({ device: null, platform: null });
      }
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

// 送出單一座標
app.post('/api/location', (req, res) => {
  const { lat, lng } = req.body;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.json({ success: false, error: '無效的座標' });
  }
  if (!isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.json({ success: false, error: '座標超出有效範圍（lat: -90~90, lng: -180~180）' });
  }
  const svcCmd = useForegroundService ? 'start-foreground-service' : 'startservice';
  const cmd = `adb shell am ${svcCmd} -n io.appium.settings/.LocationService --es longitude "${lng}" --es latitude "${lat}"`;
  exec(cmd, (error) => {
    if (error) {
      return res.json({ success: false, error: error.message });
    }
    startKeepalive(lat, lng);
    res.json({ success: true });
  });
});

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
  // 驗證 speed_kmh 必須為正數
  if (typeof speed_kmh !== 'number' || speed_kmh <= 0) {
    return res.json({ success: false, error: '速度必須為正數' });
  }
  stopKeepalive();
  if (routeTimer) { clearTimeout(routeTimer); routeTimer = null; }

  const BASE_INTERVAL_MS = 500;
  const speedMs = (speed_kmh * 1000) / 3600; // 公尺/秒
  const baseStepMeters = speedMs * (BASE_INTERVAL_MS / 1000); // 基準每次移動距離
  const GPS_JITTER_METERS = 2; // GPS 抖動範圍（公尺）
  const SPEED_VARIANCE = 0.25; // 速度隨機波動 ±25%
  const INTERVAL_VARIANCE = 0.2; // 間隔隨機波動 ±20%

  let segIndex = 0;
  let progress = 0; // 在當前線段上已走的公尺

  // 先送出起點座標（帶 GPS 抖動）
  const startJittered = addGpsJitter(waypoints[0].lat, waypoints[0].lng, GPS_JITTER_METERS);
  sendLocation(startJittered.lat, startJittered.lng);
  routeCurrentPos = { lat: startJittered.lat, lng: startJittered.lng };

  // 使用遞迴 setTimeout 實現不等間隔（比 setInterval 更自然）
  function tick() {
    if (segIndex >= waypoints.length - 1) {
      if (routeCurrentPos) startKeepalive(routeCurrentPos.lat, routeCurrentPos.lng);
      routeTimer = null;
      return;
    }

    // 隨機化本次移動距離（模擬步行速度不均）
    const speedFactor = randomBetween(1 - SPEED_VARIANCE, 1 + SPEED_VARIANCE);
    const stepMeters = baseStepMeters * speedFactor;
    progress += stepMeters;

    // 跨越線段時累計 progress
    while (segIndex < waypoints.length - 1) {
      const segDist = haversineDistance(
        waypoints[segIndex].lat, waypoints[segIndex].lng,
        waypoints[segIndex + 1].lat, waypoints[segIndex + 1].lng
      );
      if (segDist === 0) { segIndex++; continue; }
      if (progress >= segDist) {
        progress -= segDist;
        segIndex++;
        if (segIndex >= waypoints.length - 1) {
          const endJittered = addGpsJitter(
            waypoints[waypoints.length - 1].lat,
            waypoints[waypoints.length - 1].lng,
            GPS_JITTER_METERS
          );
          sendLocation(endJittered.lat, endJittered.lng);
          routeCurrentPos = { lat: endJittered.lat, lng: endJittered.lng };
          routeTimer = null;
          startKeepalive(endJittered.lat, endJittered.lng);
          return;
        }
      } else {
        break;
      }
    }

    if (segIndex >= waypoints.length - 1) {
      if (routeCurrentPos) startKeepalive(routeCurrentPos.lat, routeCurrentPos.lng);
      routeTimer = null; return;
    }

    const segDist = haversineDistance(
      waypoints[segIndex].lat, waypoints[segIndex].lng,
      waypoints[segIndex + 1].lat, waypoints[segIndex + 1].lng
    );
    const t = segDist > 0 ? progress / segDist : 0;
    const lat = waypoints[segIndex].lat + t * (waypoints[segIndex + 1].lat - waypoints[segIndex].lat);
    const lng = waypoints[segIndex].lng + t * (waypoints[segIndex + 1].lng - waypoints[segIndex].lng);

    // 加入 GPS 抖動
    const jittered = addGpsJitter(lat, lng, GPS_JITTER_METERS);
    sendLocation(jittered.lat, jittered.lng);
    routeCurrentPos = { lat: jittered.lat, lng: jittered.lng };

    // 隨機化下次 tick 間隔
    const intervalFactor = randomBetween(1 - INTERVAL_VARIANCE, 1 + INTERVAL_VARIANCE);
    const nextInterval = Math.round(BASE_INTERVAL_MS * intervalFactor);
    routeTimer = setTimeout(tick, nextInterval);
  }

  // 啟動第一次 tick
  const firstInterval = Math.round(BASE_INTERVAL_MS * randomBetween(0.8, 1.2));
  routeTimer = setTimeout(tick, firstInterval);

  res.json({ success: true });
});

app.post('/api/route/stop', (req, res) => {
  if (routeTimer) {
    clearTimeout(routeTimer);
    routeTimer = null;
  }
  if (routeCurrentPos) {
    startKeepalive(routeCurrentPos.lat, routeCurrentPos.lng);
    routeCurrentPos = null;
  }
  res.json({ success: true });
});

// 查詢路徑播放狀態
app.get('/api/route/status', (req, res) => {
  res.json({ playing: routeTimer !== null, currentPos: routeCurrentPos });
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
