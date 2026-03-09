// =============================================
// 全域狀態
// =============================================
let mapProvider = null; // Map Provider (GoogleMapsProvider 或 LeafletProvider)
let marker = null;
let waypoints = [];
let waypointMarkers = [];
let waypointMode = false;
let routePollingTimer = null;
let routePolyline = null;
let previewMarker = null; // 最愛地點載入時的黃色預覽 marker
let keepalivePollingTimer = null;
let confirmedPos = null; // 最後一次送出 ADB 的座標（↩ 按鈕用）

// =============================================
// localStorage 狀態持久化
// =============================================
const LS_PREFIX = 'fakegps_';

function saveState() {
  const coord = parseCoordInput();
  const lat = coord ? coord.lat : '';
  const lng = coord ? coord.lng : '';
  const speed = document.getElementById('speed-slider').value;
  const step = document.getElementById('input-step').value;
  const zoom = mapProvider ? mapProvider.getZoom() : 15;

  localStorage.setItem(LS_PREFIX + 'lat', lat);
  localStorage.setItem(LS_PREFIX + 'lng', lng);
  localStorage.setItem(LS_PREFIX + 'zoom', zoom);
  localStorage.setItem(LS_PREFIX + 'speed', speed);
  localStorage.setItem(LS_PREFIX + 'step', step);
  localStorage.setItem(LS_PREFIX + 'waypoints', JSON.stringify(waypoints));
}

function loadState() {
  const saved = {
    lat: parseFloat(localStorage.getItem(LS_PREFIX + 'lat')),
    lng: parseFloat(localStorage.getItem(LS_PREFIX + 'lng')),
    zoom: parseInt(localStorage.getItem(LS_PREFIX + 'zoom'), 10),
    speed: localStorage.getItem(LS_PREFIX + 'speed'),
    step: localStorage.getItem(LS_PREFIX + 'step'),
    waypoints: localStorage.getItem(LS_PREFIX + 'waypoints'),
  };

  // 座標與 zoom
  const lat = isNaN(saved.lat) ? 25.033611 : saved.lat;
  const lng = isNaN(saved.lng) ? 121.564722 : saved.lng;
  const zoom = isNaN(saved.zoom) ? 15 : saved.zoom;

  // 速度與步距
  if (saved.speed) {
    document.getElementById('speed-slider').value = saved.speed;
    document.getElementById('speed-display').textContent = `${saved.speed} km/h`;
  }
  if (saved.step) {
    document.getElementById('input-step').value = saved.step;
  }

  // 航點
  let savedWaypoints = [];
  if (saved.waypoints) {
    try { savedWaypoints = JSON.parse(saved.waypoints); } catch { /* 忽略 */ }
  }

  return { lat, lng, zoom, waypoints: savedWaypoints };
}

// =============================================
// 最愛地點 / 最愛路徑
// =============================================
const FAV_LOC_KEY = 'fakegps_fav_locations';
const FAV_ROUTE_KEY = 'fakegps_fav_routes';
const HIST_KEY = 'fakegps_history';
const HIST_MAX = 10;

function loadFavLocations() {
  try { return JSON.parse(localStorage.getItem(FAV_LOC_KEY)) || []; } catch { return []; }
}
function saveFavLocations(arr) {
  localStorage.setItem(FAV_LOC_KEY, JSON.stringify(arr));
}
function loadFavRoutes() {
  try { return JSON.parse(localStorage.getItem(FAV_ROUTE_KEY)) || []; } catch { return []; }
}
function saveFavRoutes(arr) {
  localStorage.setItem(FAV_ROUTE_KEY, JSON.stringify(arr));
}

// 最愛地點
function addFavLocation(name, lat, lng) {
  const arr = loadFavLocations();
  arr.push({ id: Date.now(), name, lat, lng });
  saveFavLocations(arr);
  renderFavLocations();
}
function removeFavLocation(id) {
  saveFavLocations(loadFavLocations().filter(f => f.id !== id));
  renderFavLocations();
}
function renderFavLocations() {
  const list = document.getElementById('fav-location-list');
  const arr = loadFavLocations();
  list.innerHTML = '';
  arr.forEach(f => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = f.name;
    span.title = `${f.lat.toFixed(6)}, ${f.lng.toFixed(6)}`;
    const btnLoad = document.createElement('button');
    btnLoad.className = 'btn-load';
    btnLoad.textContent = '📍';
    btnLoad.title = '載入此地點';
    btnLoad.addEventListener('click', () => setPreviewLocation(f.lat, f.lng));
    const btnDel = document.createElement('button');
    btnDel.className = 'btn-del';
    btnDel.textContent = '✕';
    btnDel.title = '刪除';
    btnDel.addEventListener('click', () => removeFavLocation(f.id));
    li.appendChild(span);
    li.appendChild(btnLoad);
    li.appendChild(btnDel);
    list.appendChild(li);
  });
}

// 最愛路徑
function addFavRoute(name, wps) {
  const arr = loadFavRoutes();
  arr.push({ id: Date.now(), name, waypoints: wps });
  saveFavRoutes(arr);
  renderFavRoutes();
}
function removeFavRoute(id) {
  saveFavRoutes(loadFavRoutes().filter(f => f.id !== id));
  renderFavRoutes();
}
function loadFavRoute(wps) {
  clearWaypoints();
  wps.forEach(wp => addWaypoint(wp.lat, wp.lng));
}
function renderFavRoutes() {
  const list = document.getElementById('fav-route-list');
  const arr = loadFavRoutes();
  list.innerHTML = '';
  arr.forEach(f => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = `${f.name} (${f.waypoints.length}點)`;
    const btnLoad = document.createElement('button');
    btnLoad.className = 'btn-load';
    btnLoad.textContent = '▶';
    btnLoad.title = '載入路徑';
    btnLoad.addEventListener('click', () => loadFavRoute(f.waypoints));
    const btnDel = document.createElement('button');
    btnDel.className = 'btn-del';
    btnDel.textContent = '✕';
    btnDel.title = '刪除';
    btnDel.addEventListener('click', () => removeFavRoute(f.id));
    li.appendChild(span);
    li.appendChild(btnLoad);
    li.appendChild(btnDel);
    list.appendChild(li);
  });
}

// =============================================
// 位置歷史（最多 10 筆，localStorage）
// =============================================
function loadLocationHistory() {
  try { return JSON.parse(localStorage.getItem(HIST_KEY)) || []; } catch { return []; }
}
function saveLocationHistory(arr) { localStorage.setItem(HIST_KEY, JSON.stringify(arr)); }

/**
 * 將座標加入歷史最前端（若與 arr[0] 相同則略過）。
 * 裁切至 HIST_MAX，存檔並重新渲染。
 */
function pushLocationHistory(lat, lng) {
  const arr = loadLocationHistory();
  if (arr.length > 0 && arr[0].lat === lat && arr[0].lng === lng) return;
  arr.unshift({ lat, lng, ts: Date.now() });
  if (arr.length > HIST_MAX) arr.length = HIST_MAX;
  saveLocationHistory(arr);
  renderLocationHistory();
  updateBackButton();
}

function renderLocationHistory() {
  const list = document.getElementById('history-list');
  const summary = document.getElementById('history-summary');
  const arr = loadLocationHistory();
  if (summary) summary.textContent = `歷史記錄（${arr.length}）`;
  if (!list) return;
  list.innerHTML = '';
  arr.forEach(entry => {
    const li = document.createElement('li');
    li.className = 'history-item';
    const span = document.createElement('span');
    const d = new Date(entry.ts);
    const t = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    span.textContent = `${t}  ${entry.lat.toFixed(5)}, ${entry.lng.toFixed(5)}`;
    span.title = `${entry.lat.toFixed(6)}, ${entry.lng.toFixed(6)}`;
    const btn = document.createElement('button');
    btn.className = 'btn-load';
    btn.textContent = '📍';
    btn.title = '載入為預覽（需再按「✓ 改變定位」確認）';
    btn.addEventListener('click', () => setPreviewLocation(entry.lat, entry.lng));
    li.appendChild(span);
    li.appendChild(btn);
    list.appendChild(li);
  });
}

function updateBackButton() {
  const btn = document.getElementById('btn-back-location');
  if (btn) btn.disabled = confirmedPos === null;
}

// =============================================
// 工具函式：顯示狀態訊息（3 秒後自動消失）
// =============================================
let _statusTimer = null;
function showStatus(msg, isError = false) {
  const el = document.getElementById('status-msg');
  el.textContent = msg;
  el.style.color = isError ? '#f38ba8' : '#a6e3a1';
  el.style.borderColor = isError ? 'rgba(243, 139, 168, 0.25)' : 'rgba(166, 227, 161, 0.25)';
  el.style.opacity = '1';
  if (_statusTimer) clearTimeout(_statusTimer);
  _statusTimer = setTimeout(() => { el.style.opacity = '0'; }, 3000);
}

// =============================================
// 送出座標到後端 API
// =============================================
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
      refreshKeepalive();
    } else {
      showStatus(`✗ 錯誤：${data.error}`, true);
    }
  } catch (e) {
    showStatus(`✗ 網路錯誤：${e.message}`, true);
  }
}

// =============================================
// 預覽 Marker（最愛地點載入用，黃色，不送 ADB）
// =============================================
function clearPreviewMarker() {
  if (previewMarker) {
    mapProvider.removeMarker(previewMarker);
    previewMarker = null;
  }
}

// 讀取 input-coord，回傳 {lat, lng} 或 null
function parseCoordInput() {
  const raw = document.getElementById('input-coord').value.trim();
  const parts = raw.split(/[\s,]+/);
  if (parts.length < 2) return null;
  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
}

// 將 lat/lng 寫入 input-coord
function setCoordInput(lat, lng) {
  document.getElementById('input-coord').value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function setPreviewLocation(lat, lng) {
  setCoordInput(lat, lng);
  mapProvider.panTo(lat, lng);
  clearPreviewMarker();
  previewMarker = mapProvider.createPreviewMarker(lat, lng);
  showStatus('📍 已載入預覽位置，按「送出座標」確認');
}

// =============================================
// 更新輸入框、地圖 pin，並（可選）送出 ADB 指令
// =============================================
function setLocation(lat, lng, sendAdb = true) {
  clearPreviewMarker();
  setCoordInput(lat, lng);
  if (marker) {
    mapProvider.setMarkerPosition(marker, lat, lng);
  } else {
    marker = mapProvider.createMainMarker(lat, lng);
  }
  mapProvider.panTo(lat, lng);
  if (sendAdb) {
    sendLocation(lat, lng);
    confirmedPos = { lat, lng };
    updateBackButton();
  }
  saveState();
}

// =============================================
// Map Provider 類別
// =============================================

class GoogleMapsProvider {
  constructor() { this._map = null; }

  createMap(id, lat, lng, zoom) {
    this._map = new google.maps.Map(document.getElementById(id), {
      center: { lat, lng }, zoom,
    });
    return this._map;
  }
  panTo(lat, lng) { this._map.panTo({ lat, lng }); }
  setZoom(z) { this._map.setZoom(z); }
  getZoom() { return this._map.getZoom(); }
  onZoomChanged(cb) { this._map.addListener('zoom_changed', cb); }
  onMapClick(cb) {
    this._map.addListener('click', e => cb(e.latLng.lat(), e.latLng.lng()));
  }
  createMainMarker(lat, lng) {
    return new google.maps.Marker({
      position: { lat, lng }, map: this._map, title: 'Current Location',
    });
  }
  createPreviewMarker(lat, lng) {
    return new google.maps.Marker({
      position: { lat, lng },
      map: this._map,
      title: '預覽位置（尚未送出）',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#f9e2af',
        fillOpacity: 1,
        strokeColor: '#1e1e2e',
        strokeWeight: 2,
      },
    });
  }
  createWaypointMarker(lat, lng, label) {
    return new google.maps.Marker({
      position: { lat, lng },
      map: this._map,
      label: String(label),
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#cba6f7',
        fillOpacity: 1,
        strokeColor: '#1e1e2e',
        strokeWeight: 2,
      },
    });
  }
  setMarkerPosition(m, lat, lng) { m.setPosition({ lat, lng }); }
  setMarkerLabel(m, label) { m.setLabel(String(label)); }
  removeMarker(m) { m.setMap(null); }
  createPolyline(wps) {
    return new google.maps.Polyline({
      path: wps.map(w => ({ lat: w.lat, lng: w.lng })),
      geodesic: true,
      strokeColor: '#89b4fa',
      strokeOpacity: 0.8,
      strokeWeight: 4,
      map: this._map,
    });
  }
  removePolyline(p) { p.setMap(null); }
  initSearch(inputEl, onSelect) {
    const ac = new google.maps.places.Autocomplete(inputEl, { fields: ['geometry', 'name'] });
    ac.bindTo('bounds', this._map);
    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (!place.geometry || !place.geometry.location) {
        showStatus('找不到該地點', true);
        return;
      }
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      onSelect(lat, lng, place.name || '所選地點');
    });
  }
}

class LeafletProvider {
  constructor() {
    this._map = null;
    this._nominatimLastTime = 0;
  }

  createMap(id, lat, lng, zoom) {
    this._map = L.map(id).setView([lat, lng], zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this._map);
    return this._map;
  }
  panTo(lat, lng) { this._map.panTo([lat, lng]); }
  setZoom(z) { this._map.setZoom(z); }
  getZoom() { return this._map.getZoom(); }
  onZoomChanged(cb) { this._map.on('zoomend', cb); }
  onMapClick(cb) {
    this._map.on('click', e => cb(e.latlng.lat, e.latlng.lng));
  }
  _createMainIcon() {
    return L.divIcon({
      className: 'main-marker',
      html: '<div class="main-marker-pin"></div>',
      iconSize: [14, 14],
      iconAnchor: [7, 14],
    });
  }
  createMainMarker(lat, lng) {
    return L.marker([lat, lng], { icon: this._createMainIcon() }).addTo(this._map);
  }
  createPreviewMarker(lat, lng) {
    return L.circleMarker([lat, lng], {
      fillColor: '#f9e2af',
      fillOpacity: 1,
      radius: 10,
      color: '#1e1e2e',
      weight: 2,
    }).addTo(this._map);
  }
  createWaypointMarker(lat, lng, label) {
    const icon = L.divIcon({
      className: 'wp-marker',
      html: (() => { const d = document.createElement('div'); d.className = 'wp-marker-circle'; const s = document.createElement('span'); s.className = 'wp-label'; s.textContent = String(label); d.appendChild(s); return d.outerHTML; })(),
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    return L.marker([lat, lng], { icon }).addTo(this._map);
  }
  setMarkerPosition(m, lat, lng) { m.setLatLng([lat, lng]); }
  setMarkerLabel(m, label) {
    const el = m.getElement();
    if (el) {
      const span = el.querySelector('.wp-label');
      if (span) span.textContent = String(label);
    }
  }
  removeMarker(m) { m.remove(); }
  createPolyline(wps) {
    return L.polyline(
      wps.map(w => [w.lat, w.lng]),
      { color: '#89b4fa', opacity: 0.8, weight: 4 }
    ).addTo(this._map);
  }
  removePolyline(p) { p.remove(); }
  initSearch(inputEl, onSelect) {
    inputEl.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter') return;
      const query = inputEl.value.trim();
      if (!query) return;
      // Nominatim rate limit: 1 req/s
      const now = Date.now();
      if (now - this._nominatimLastTime < 1000) {
        showStatus('搜尋太頻繁，請稍候', true);
        return;
      }
      this._nominatimLastTime = now;
      try {
        showStatus('搜尋中...');
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'zh-TW,zh,en' } });
        const data = await res.json();
        if (!data.length) { showStatus('找不到該地點', true); return; }
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon); // Nominatim 使用 lon 而非 lng
        onSelect(lat, lng, data[0].display_name || query);
      } catch (err) {
        showStatus(`搜尋失敗：${err.message}`, true);
      }
    });
  }
}

// =============================================
// API Key 管理
// =============================================
const GMAPS_KEY = 'fakegps_gmaps_key';

function getApiKey() {
  return localStorage.getItem(GMAPS_KEY) || '';
}

function loadGoogleMapsScript(key) {
  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&callback=initApp`;
  script.async = true;
  script.defer = true;
  script.onerror = () => {
    localStorage.removeItem(GMAPS_KEY);
    const statusEl = document.getElementById('apikey-status');
    if (statusEl) statusEl.textContent = '⚠ API Key 無效，正在切換到 OpenStreetMap...';
    setTimeout(() => location.reload(), 1500);
  };
  document.head.appendChild(script);
}

function setupApiKeyControls() {
  const input = document.getElementById('input-apikey');
  const statusEl = document.getElementById('apikey-status');
  const key = getApiKey();

  // 顯示目前狀態
  if (key) {
    statusEl.textContent = '✓ 目前使用 Google Maps';
    input.value = key;
  } else {
    statusEl.textContent = '目前使用 OpenStreetMap（免費）';
  }

  document.getElementById('btn-apikey-apply').addEventListener('click', () => {
    const val = input.value.trim();
    if (val) {
      localStorage.setItem(GMAPS_KEY, val);
    } else {
      localStorage.removeItem(GMAPS_KEY);
    }
    location.reload();
  });

  document.getElementById('btn-apikey-clear').addEventListener('click', () => {
    localStorage.removeItem(GMAPS_KEY);
    location.reload();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-apikey-apply').click();
  });
}

// =============================================
// 應用程式初始化（由 Google Maps callback 或 DOMContentLoaded 呼叫）
// =============================================
window.initApp = function initApp() {
  const key = getApiKey();
  mapProvider = key ? new GoogleMapsProvider() : new LeafletProvider();

  const saved = loadState();
  mapProvider.createMap('map', saved.lat, saved.lng, saved.zoom);

  // 恢復座標輸入框與 marker
  setCoordInput(saved.lat, saved.lng);
  marker = mapProvider.createMainMarker(saved.lat, saved.lng);
  confirmedPos = { lat: saved.lat, lng: saved.lng };
  updateBackButton();

  // 恢復航點
  if (saved.waypoints.length > 0) {
    saved.waypoints.forEach(wp => addWaypoint(wp.lat, wp.lng));
  }

  // 監聽 zoom 變化以儲存
  mapProvider.onZoomChanged(saveState);

  // 點擊地圖
  mapProvider.onMapClick((lat, lng) => {
    if (waypointMode) {
      addWaypoint(lat, lng);
    } else {
      setPreviewLocation(lat, lng);
    }
  });

  // 搜尋初始化
  mapProvider.initSearch(document.getElementById('input-search'), (lat, lng, name) => {
    mapProvider.setZoom(15);
    setPreviewLocation(lat, lng);
    showStatus(`已載入預覽：${name}，按「✓ 改變定位」確認`);
  });

  setupApiKeyControls();
  setupControls();
  renderFavLocations();
  renderFavRoutes();
  renderLocationHistory();
  updateBackButton();
};

// DOMContentLoaded：決定載入 Google Maps 或直接初始化 Leaflet
document.addEventListener('DOMContentLoaded', () => {
  const key = getApiKey();
  if (key) {
    loadGoogleMapsScript(key);
    // initApp 將由 Google Maps callback 自動呼叫
  } else {
    initApp();
  }
});

// =============================================
// 控制面板互動設定
// =============================================
function setupControls() {
  // input-coord Enter → 預覽（不送 ADB）
  document.getElementById('input-coord').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const coord = parseCoordInput();
    if (!coord) return showStatus('請輸入有效座標（格式：緯度, 經度）', true);
    setPreviewLocation(coord.lat, coord.lng);
  });

  // ✓ 改變定位 → 確認送 ADB + 加入歷史
  document.getElementById('btn-confirm-location').addEventListener('click', () => {
    const coord = parseCoordInput();
    if (!coord) return showStatus('請輸入有效座標（格式：緯度, 經度）', true);
    setLocation(coord.lat, coord.lng, true);
    pushLocationHistory(coord.lat, coord.lng);
  });

  // ↩ 回到目前定位 → 將地圖視角移回最後一次確認的位置（不重送 ADB）
  document.getElementById('btn-back-location').addEventListener('click', () => {
    if (!confirmedPos) return;
    mapProvider.panTo(confirmedPos.lat, confirmedPos.lng);
    showStatus('📍 已回到目前定位');
  });

  // 裝置狀態刷新
  document.getElementById('btn-refresh-device').addEventListener('click', refreshDevice);
  refreshDevice();

  // Keepalive 手動切換
  document.getElementById('btn-keepalive-toggle').addEventListener('click', async () => {
    try {
      const statusRes = await fetch('/api/keepalive');
      const { active } = await statusRes.json();
      await fetch('/api/keepalive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !active }),
      });
      refreshKeepalive();
    } catch (e) {
      showStatus(`✗ keepalive 操作失敗：${e.message}`, true);
    }
  });

  // 定期輪詢 keepalive 狀態（每 3 秒）
  keepalivePollingTimer = setInterval(refreshKeepalive, 3000);
  refreshKeepalive();

  // =============================================
  // D-Pad 八方向 + 按住持續移動
  // =============================================
  const EARTH_R = 6371000;
  const DIAG = 1 / Math.SQRT2; // 斜向歸一化 ~0.7071

  function moveLocation(dLat, dLng) {
    const coord = parseCoordInput();
    const lat = coord ? coord.lat : 25.0478;
    const lng = coord ? coord.lng : 121.5319;
    const step = parseFloat(document.getElementById('input-step').value) || 10;
    const newLat = lat + (dLat * step / EARTH_R) * (180 / Math.PI);
    const newLng = lng + (dLng * step / (EARTH_R * Math.cos(lat * Math.PI / 180))) * (180 / Math.PI);
    setLocation(newLat, newLng, true);
  }

  // 八方向定義：[dLat, dLng]
  const directions = {
    'btn-up':         [1, 0],
    'btn-down':       [-1, 0],
    'btn-left':       [0, -1],
    'btn-right':      [0, 1],
    'btn-up-left':    [DIAG, -DIAG],
    'btn-up-right':   [DIAG, DIAG],
    'btn-down-left':  [-DIAG, -DIAG],
    'btn-down-right': [-DIAG, DIAG],
  };

  let dpadTimer = null;

  function startDpadMove(dLat, dLng) {
    moveLocation(dLat, dLng); // 立即移動一次
    dpadTimer = setInterval(() => {
      moveLocation(dLat, dLng);
    }, 150); // 每 150ms 持續移動
  }

  function stopDpadMove() {
    if (dpadTimer) {
      clearInterval(dpadTimer);
      dpadTimer = null;
    }
  }

  Object.entries(directions).forEach(([id, [dLat, dLng]]) => {
    const btn = document.getElementById(id);
    // 滑鼠事件
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      startDpadMove(dLat, dLng);
    });
    btn.addEventListener('mouseup', stopDpadMove);
    btn.addEventListener('mouseleave', stopDpadMove);
    // 觸控事件
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      startDpadMove(dLat, dLng);
    });
    btn.addEventListener('touchend', stopDpadMove);
    btn.addEventListener('touchcancel', stopDpadMove);
  });

  // 中心按鈕：重新送出當前座標
  document.getElementById('btn-center').addEventListener('click', () => {
    const coord = parseCoordInput();
    if (coord) sendLocation(coord.lat, coord.lng);
  });

  // 速度滑桿即時顯示
  const speedSlider = document.getElementById('speed-slider');
  speedSlider.addEventListener('input', () => {
    document.getElementById('speed-display').textContent = `${speedSlider.value} km/h`;
    saveState();
  });

  // 微調距離變化時儲存
  document.getElementById('input-step').addEventListener('change', saveState);

  // 路徑播放按鈕
  document.getElementById('btn-route-start').addEventListener('click', startRoute);
  document.getElementById('btn-route-stop').addEventListener('click', stopRoute);
  document.getElementById('btn-route-clear').addEventListener('click', clearWaypoints);
  document.getElementById('btn-toggle-waypoint-mode').addEventListener('click', toggleWaypointMode);

  // 最愛地點
  document.getElementById('btn-fav-add-location').addEventListener('click', () => {
    const coord = parseCoordInput();
    if (!coord) return showStatus('請先設定座標', true);
    const name = prompt('地點名稱：');
    if (name && name.trim()) addFavLocation(name.trim(), coord.lat, coord.lng);
  });

  // 最愛路徑
  document.getElementById('btn-fav-save-route').addEventListener('click', () => {
    if (waypoints.length < 2) return showStatus('至少需要 2 個航點才能儲存路徑', true);
    const name = prompt('路徑名稱：');
    if (name && name.trim()) addFavRoute(name.trim(), waypoints.map(wp => ({ ...wp })));
  });
}

// =============================================
// 刷新 ADB 裝置狀態
// =============================================
async function refreshDevice() {
  try {
    const res = await fetch('/api/device');
    const data = await res.json();
    if (data.device) {
      const platformLabel = data.platform === 'ios' ? ' (iOS)' : data.platform === 'android' ? ' (Android)' : '';
      document.getElementById('device-status').textContent = data.device + platformLabel;
    } else {
      document.getElementById('device-status').textContent = '未偵測';
    }
  } catch {
    document.getElementById('device-status').textContent = '無法連線到後端';
  }
}

async function refreshKeepalive() {
  try {
    const res = await fetch('/api/keepalive');
    const data = await res.json();
    const indicator = document.getElementById('keepalive-indicator');
    const btn = document.getElementById('btn-keepalive-toggle');
    if (data.active) {
      indicator.textContent = '🔒 GPS 鎖定中';
      btn.textContent = '暫停鎖定';
      btn.disabled = false;
    } else {
      indicator.textContent = data.location ? '⏸ 未鎖定' : '';
      btn.textContent = '恢復鎖定';
      btn.disabled = !data.location;
    }
  } catch { /* 忽略連線錯誤 */ }
}

// =============================================
// 航點模式切換
// =============================================
function toggleWaypointMode() {
  waypointMode = !waypointMode;
  const btn = document.getElementById('btn-toggle-waypoint-mode');
  btn.textContent = waypointMode ? '關閉航點模式' : '開啟航點模式';
  btn.style.background = waypointMode ? '#a6e3a1' : '';
  btn.style.color = waypointMode ? '#1e1e2e' : '';
  document.getElementById('waypoint-mode-hint').textContent = waypointMode
    ? '點擊地圖新增航點'
    : '在地圖上點擊新增航點（先開啟模式）';
}

// =============================================
// 兩點間距離（公里，Haversine）
// =============================================
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// =============================================
// 新增航點
// =============================================
function addWaypoint(lat, lng) {
  waypoints.push({ lat, lng });
  const waypointMarker = mapProvider.createWaypointMarker(lat, lng, waypoints.length);
  waypointMarkers.push(waypointMarker);
  renderWaypointList();
  document.getElementById('btn-route-start').disabled = waypoints.length < 1;
  saveState();
}

// =============================================
// 刪除單一航點
// =============================================
function removeWaypoint(index) {
  waypoints.splice(index, 1);
  mapProvider.removeMarker(waypointMarkers[index]);
  waypointMarkers.splice(index, 1);
  // 重新標號
  waypointMarkers.forEach((m, i) => mapProvider.setMarkerLabel(m, i + 1));
  renderWaypointList();
  document.getElementById('btn-route-start').disabled = waypoints.length < 1;
  saveState();
}

// =============================================
// 清除所有航點
// =============================================
function clearWaypoints() {
  waypoints = [];
  waypointMarkers.forEach((m) => mapProvider.removeMarker(m));
  waypointMarkers = [];
  if (routePolyline) { mapProvider.removePolyline(routePolyline); routePolyline = null; }
  renderWaypointList();
  document.getElementById('btn-route-start').disabled = true;
  saveState();
}

// =============================================
// 渲染航點清單
// =============================================
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

// =============================================
// 開始路徑播放
// =============================================
async function startRoute() {
  if (waypoints.length < 1) return showStatus('至少需要 1 個航點', true);
  if (!confirmedPos) return showStatus('請先確認目前定位（紅色 Marker）', true);

  // 距離警告：起點（confirmedPos）到第一個航點超過 20km
  const distKm = haversineKm(confirmedPos.lat, confirmedPos.lng, waypoints[0].lat, waypoints[0].lng);
  if (distKm > 20) {
    if (!confirm(`目前位置與第一個航點距離 ${distKm.toFixed(1)} km，確定要播放路徑嗎？`)) return;
  }

  // 以 confirmedPos 為起點，串接所有航點
  const routeWaypoints = [{ lat: confirmedPos.lat, lng: confirmedPos.lng }, ...waypoints];

  const speed_kmh = parseInt(document.getElementById('speed-slider').value, 10);
  try {
    const res = await fetch('/api/route/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ waypoints: routeWaypoints, speed_kmh }),
    });
    const data = await res.json();
    if (data.success) {
      showStatus('▶ 路徑播放中...');
      document.getElementById('btn-route-start').disabled = true;
      document.getElementById('btn-route-stop').disabled = false;

      // 畫出路線 polyline
      if (routePolyline) mapProvider.removePolyline(routePolyline);
      routePolyline = mapProvider.createPolyline(waypoints);

      // 開始輪詢路徑播放狀態
      routePollingTimer = setInterval(async () => {
        try {
          const statusRes = await fetch('/api/route/status');
          const statusData = await statusRes.json();

          // 更新 marker 到當前播放座標
          if (statusData.currentPos) {
            const { lat, lng } = statusData.currentPos;
            setCoordInput(lat, lng);
            if (marker) {
              mapProvider.setMarkerPosition(marker, lat, lng);
            } else {
              marker = mapProvider.createMainMarker(lat, lng);
            }
          }

          if (!statusData.playing) {
            // 路徑播放結束
            clearInterval(routePollingTimer);
            routePollingTimer = null;
            document.getElementById('btn-route-stop').disabled = true;
            showStatus('✓ 路徑播放完成');
            refreshKeepalive();

            // 更新 confirmedPos 到終點
            if (statusData.currentPos) {
              confirmedPos = { lat: statusData.currentPos.lat, lng: statusData.currentPos.lng };
              updateBackButton();
            }

            // 詢問是否清除所有航點
            if (waypoints.length > 0 && confirm('路徑播放完成，是否清除所有航點？')) {
              clearWaypoints();
            }

            document.getElementById('btn-route-start').disabled = waypoints.length < 1;
          }
        } catch { /* 忽略輪詢錯誤 */ }
      }, 1000);
    } else {
      showStatus(`✗ ${data.error}`, true);
    }
  } catch (e) {
    showStatus(`✗ ${e.message}`, true);
  }
}

// =============================================
// 停止路徑播放
// =============================================
async function stopRoute() {
  try {
    await fetch('/api/route/stop', { method: 'POST' });
    showStatus('■ 路徑播放已停止');
    refreshKeepalive();
  } catch {
    showStatus('■ 停止（無法連線後端）', true);
  }
  if (routePollingTimer) {
    clearInterval(routePollingTimer);
    routePollingTimer = null;
  }
  document.getElementById('btn-route-start').disabled = waypoints.length < 2;
  document.getElementById('btn-route-stop').disabled = true;
}
