#!/usr/bin/env python3
"""
iOS GPS 位置模擬常駐程式

透過 DVT LocationSimulation 維持持久連線，從 stdin 讀取 lat,lng 更新位置。
server.js 以 spawn 方式啟動此程式，透過 stdin 管線發送座標。

用法：
  ios_location_daemon.py [UDID]
  - 若提供 UDID，僅綁定該 UDID 的裝置；找不到則錯誤退出
  - 不提供時，使用 tunneld 回傳的第一台裝置（向後相容）

stdin 格式：每行 "lat,lng"，例如 "25.0330,121.5654"
stdout：啟動成功後輸出 "READY\n"，每次設定成功輸出 "OK\n"
stderr：錯誤訊息

結束方式：stdin 關閉（EOF）或收到 SIGTERM
"""

import asyncio
import sys
import logging

logging.basicConfig(level=logging.WARNING, stream=sys.stderr)


def _device_udid(d) -> str:
    return getattr(d, "udid", None) or getattr(d, "UniqueDeviceID", None) or ""


async def main() -> None:
    from pymobiledevice3.tunneld.api import get_tunneld_devices
    from pymobiledevice3.services.dvt.instruments.dvt_provider import DvtProvider
    from pymobiledevice3.services.dvt.instruments.location_simulation import LocationSimulation

    udid_filter = sys.argv[1] if len(sys.argv) > 1 else None

    # 透過 tunneld 取得裝置
    try:
        devices = await get_tunneld_devices()
    except Exception as e:
        print(f"ERROR: tunneld 連線失敗: {e}", file=sys.stderr, flush=True)
        sys.exit(1)

    if not devices:
        print("ERROR: tunneld 找不到裝置，請確認 tunneld 已啟動", file=sys.stderr, flush=True)
        sys.exit(1)

    if udid_filter:
        matches = [d for d in devices if _device_udid(d) == udid_filter]
        if not matches:
            print(f"ERROR: 找不到 UDID 為 {udid_filter} 的裝置", file=sys.stderr, flush=True)
            sys.exit(1)
        device = matches[0]
    else:
        device = devices[0]

    try:
        dvt = DvtProvider(device)
        async with LocationSimulation(dvt) as location_sim:

            # 通知 server.js 已就緒
            print("READY", flush=True)

            loop = asyncio.get_running_loop()

            while True:
                # 從 stdin 讀取一行（blocking，在 executor 中執行）
                line = await loop.run_in_executor(None, sys.stdin.readline)
                if not line:
                    # EOF：server.js 關閉了 stdin，正常退出
                    break

                line = line.strip()
                if not line:
                    continue

                try:
                    lat_str, lng_str = line.split(",", 1)
                    await location_sim.set(float(lat_str), float(lng_str))
                    print("OK", flush=True)
                except ValueError:
                    print(f"ERROR: 格式錯誤（應為 lat,lng）: {line}", file=sys.stderr, flush=True)
                except Exception as e:
                    print(f"ERROR: 設定位置失敗: {e}", file=sys.stderr, flush=True)

    except Exception as e:
        print(f"ERROR: DVT 連線失敗: {e}", file=sys.stderr, flush=True)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
