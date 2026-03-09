# Android Fake GPS 網頁工具 設計文件

日期：2026-03-04

## 目標

製作一個本地 Web App，讓使用者透過瀏覽器操作 Google Maps，將 GPS 座標透過 ADB 送給 Android 手機的 Appium Settings，以模擬假 GPS 位置。

## 使用情境

- 個人本地使用
- 啟動 Node.js server 後用瀏覽器操作
- 手機透過 USB 連接電腦，ADB 已設定完成

## 架構

```
瀏覽器 (前端)
  └─ HTML/CSS/JS + Google Maps API
       ↕ HTTP fetch
Node.js + Express (後端)
  └─ 執行 adb shell 指令
  └─ 管理路徑播放狀態（定時器）
       ↕ adb
Android 手機
  └─ Appium Settings（接收 GPS mock）
```

## 專案結構

```
android-fakegps/
├── server.js
├── package.json
└── public/
    ├── index.html
    ├── style.css
    └── app.js
```

## 前端介面

**版面：左右分割**

- 左側：控制面板
- 右側：Google Maps（全高）

**控制面板區塊：**

1. **裝置狀態** — 顯示 ADB 連線裝置名稱
2. **座標輸入框** — 可直接輸入 lat/lng，與地圖雙向連動
   - 輸入座標 → 地圖 pin 移動 + 送出 ADB 指令
   - 地圖點擊 → 輸入框更新 + 送出 ADB 指令
3. **方向按鈕** — 上下左右微調（預設每次 10 公尺，可調整）
4. **速度滑桿** — 路徑播放速度 1 ~ 50 km/h
5. **路徑規劃** — 在地圖點多個航點，顯示清單，可刪除單點
6. **播放控制** — 開始 / 停止路徑播放

## API Endpoints

### POST /api/location
送出單一座標

```json
Request:  { "lat": 25.0478, "lng": 121.5319 }
Response: { "success": true } | { "success": false, "error": "..." }
```

### POST /api/route/start
開始路徑播放

```json
Request:  { "waypoints": [{"lat":..,"lng":..}, ...], "speed_kmh": 10 }
Response: { "success": true }
```

### POST /api/route/stop
停止路徑播放

```json
Response: { "success": true }
```

## 路徑播放邏輯

- 固定每 500ms 送一次座標
- 根據速度與兩點距離計算每次插值步距
- 位置沿直線插值
- 抵達航點後自動跳下一個

## ADB 指令

```bash
adb shell am startservice \
  -n io.appium.settings/.LocationService \
  --es longitude "121.5319" \
  --es latitude "25.0478"
```

## 技術選型

| 部分 | 技術 |
|------|------|
| 後端 | Node.js + Express |
| 前端 | 純 HTML/CSS/JS |
| 地圖 | Google Maps JavaScript API |
| ADB 執行 | Node.js `child_process.exec` |
| 路徑播放 | 後端 `setInterval` |

## 啟動方式

```bash
npm install
npm start
# 瀏覽器開 http://localhost:3000
```
