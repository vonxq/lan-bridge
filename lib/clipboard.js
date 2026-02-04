/**
 * 剪贴板操作模块
 * 支持 macOS、Windows、Linux
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');

const execAsync = promisify(exec);

/**
 * 写入剪贴板（支持多行文本）
 * @param {string} text 要写入的文本
 */
async function writeClipboard(text) {
  const tmpFile = path.join(os.tmpdir(), `clipboard_${Date.now()}.txt`);
  
  try {
    // 写入临时文件
    fs.writeFileSync(tmpFile, text, 'utf8');
    
    // 从文件读取到剪贴板
    if (process.platform === 'darwin') {
      await execAsync(`cat "${tmpFile}" | pbcopy`);
    } else if (process.platform === 'win32') {
      await execAsync(`type "${tmpFile}" | clip`);
    } else {
      await execAsync(`cat "${tmpFile}" | xclip -selection clipboard`);
    }
  } finally {
    // 清理临时文件
    try {
      fs.unlinkSync(tmpFile);
    } catch (e) {}
  }
}

/**
 * 读取剪贴板
 * @returns {Promise<string>} 剪贴板内容
 */
async function readClipboard() {
  if (process.platform === 'darwin') {
    const { stdout } = await execAsync('pbpaste');
    return stdout;
  } else if (process.platform === 'win32') {
    const { stdout } = await execAsync('powershell Get-Clipboard');
    return stdout.trim();
  } else {
    const { stdout } = await execAsync('xclip -selection clipboard -o');
    return stdout;
  }
}

/**
 * 模拟粘贴 (Cmd+V / Ctrl+V)
 */
async function simulatePaste() {
  if (process.platform === 'darwin') {
    await execAsync(`osascript -e 'tell application "System Events" to keystroke "v" using command down'`);
  } else if (process.platform === 'win32') {
    // Windows 使用 PowerShell 模拟
    await execAsync(`powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')"`);
  }
}

/**
 * 模拟全选 (Cmd+A / Ctrl+A)
 */
async function simulateSelectAll() {
  if (process.platform === 'darwin') {
    await execAsync(`osascript -e 'tell application "System Events" to keystroke "a" using command down'`);
  }
}

/**
 * 模拟回车
 */
async function simulateEnter() {
  if (process.platform === 'darwin') {
    await execAsync(`osascript -e 'tell application "System Events" to keystroke return'`);
  } else if (process.platform === 'win32') {
    await execAsync(`powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')"`);
  }
}

/**
 * 模拟清除当前行 (Ctrl+A + Ctrl+K)
 */
async function simulateClearLine() {
  if (process.platform === 'darwin') {
    // Ctrl+A 移到行首，Ctrl+K 删除到行尾
    await execAsync(`osascript -e 'tell application "System Events" to keystroke "a" using control down'`);
    await new Promise(resolve => setTimeout(resolve, 20));
    await execAsync(`osascript -e 'tell application "System Events" to keystroke "k" using control down'`);
  }
}

/**
 * 复制当前行
 */
async function simulateCopyLine() {
  if (process.platform === 'darwin') {
    try {
      await execAsync(`osascript -e 'tell application "System Events"
        -- 移到行首
        keystroke "a" using control down
        delay 0.05
        -- 选中到行尾
        keystroke "e" using {shift down, control down}
        delay 0.05
        -- 复制
        keystroke "c" using command down
        delay 0.05
        -- 取消选中（按右箭头）
        key code 124
      end tell'`);
    } catch (e) {
      console.error('复制当前行失败:', e.message);
    }
  }
}

/**
 * 执行粘贴操作
 */
async function doPaste() {
  if (process.platform === 'darwin' || process.platform === 'win32') {
    try {
      await simulatePaste();
    } catch (error) {
      console.error('粘贴失败:', error.message);
    }
  }
}

module.exports = {
  writeClipboard,
  readClipboard,
  simulatePaste,
  simulateSelectAll,
  simulateEnter,
  simulateClearLine,
  simulateCopyLine,
  doPaste
};
