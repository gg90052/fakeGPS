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
