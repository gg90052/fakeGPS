# iOS GPS Spoofing 支援設計

## 日期
2026-03-09

## 概述
在現有 Android GPS 偽裝工具中加入 iOS 裝置支援（目標 iOS 17+），使用 `pymobiledevice3` 取代 ADB 進行 GPS 座標注入。

## 設計決策
- **單一裝置模式**：同時只連一台裝置（Android 或 iOS）
- **Tunnel 由使用者手動啟動**：使用者需先執行 `sudo pymobiledevice3 remote tunneld`，server 只負責送座標
- **自動偵測裝置類型**：`/api/device` 先偵測 Android，失敗再偵測 iOS

## 架構

### Driver 抽象層
```
server.js
  ├── currentDriver: 'android' | 'ios' | null
  ├── AndroidDriver  →  adb shell am startservice ...
  └── iOSDriver      →  pymobiledevice3 developer simulate-location set ...
```

### 指令對照
| 動作 | Android (ADB) | iOS (pymobiledevice3) |
|------|--------------|----------------------|
| 偵測裝置 | `adb devices` | `pymobiledevice3 usbmux list` |
| 送座標 | `adb shell am startservice ...` | `pymobiledevice3 developer simulate-location set -- LAT LNG` |
| 清除座標 | _(無)_ | `pymobiledevice3 developer simulate-location clear` |

### 偵測流程
1. `/api/device` 被呼叫
2. 執行 `adb devices` → 有裝置 → `currentDriver = 'android'`
3. 無 Android → 執行 `pymobiledevice3 usbmux list` → 有裝置 → `currentDriver = 'ios'`
4. 都沒有 → `currentDriver = null`

### API 變更
- `/api/device` 回傳新增 `platform: "android" | "ios" | null` 欄位

## 變更範圍

### server.js（主要改動）
1. 新增 `currentDriver` 全域變數
2. 重構 `sendLocation()` — 根據 driver 選擇指令
3. 重構 `/api/device` — 加入 iOS 偵測
4. 重構 `/api/location` — 移除內嵌 ADB 指令，改用統一 `sendLocation()`

### public/app.js（極小改動）
- 顯示 `platform` 資訊在裝置狀態區

### 文件
- README.md、quickinstall.md、tutor.md 補充 iOS 前置需求與操作說明

### 不動的部分
- 地圖系統、路徑播放、Keepalive、最愛地點、D-Pad
- public/index.html、public/style.css
