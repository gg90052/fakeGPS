#!/usr/bin/env python3
"""
列出所有可用的 iOS 裝置（USB + WiFi via tunneld）

輸出：JSON 陣列，格式與 `pymobiledevice3 usbmux list` 相容
  [{"DeviceName": "My iPhone", "UniqueDeviceID": "..."}, ...]

若 tunneld 未啟動或無裝置，輸出 []
"""

import asyncio
import json
import sys


async def main() -> None:
    from pymobiledevice3.tunneld.api import get_tunneld_devices

    try:
        devices = await asyncio.wait_for(get_tunneld_devices(), timeout=3.0)
    except Exception:
        print(json.dumps([]))
        return

    result = []
    for d in devices:
        name = (
            getattr(d, 'name', None)
            or getattr(d, 'DeviceName', None)
            or 'iOS Device'
        )
        udid = (
            getattr(d, 'udid', None)
            or getattr(d, 'UniqueDeviceID', None)
            or ''
        )
        result.append({'DeviceName': name, 'UniqueDeviceID': udid})

    print(json.dumps(result))


if __name__ == '__main__':
    asyncio.run(main())
