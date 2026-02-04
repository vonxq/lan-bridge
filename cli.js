#!/usr/bin/env node
/**
 * LAN Bridge CLI - 命令行工具
 * 
 * 用法:
 *   lan-bridge start    - 启动服务（后台运行）
 *   lan-bridge stop     - 停止服务
 *   lan-bridge status   - 查看服务状态
 *   lan-bridge password - 修改连接密码
 *   lan-bridge logs     - 查看日志
 */

const { spawn, execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const CONFIG_DIR = path.join(os.homedir(), '.lan-bridge');
const PID_FILE = path.join(CONFIG_DIR, 'server.pid');
const LOG_FILE = path.join(CONFIG_DIR, 'server.log');
const PASSWORD_FILE = path.join(CONFIG_DIR, 'password.json');
const SERVER_SCRIPT = path.join(__dirname, 'server.js');
const PORT = 9527;

// 密码哈希
function hashPassword(password, salt = null) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHmac('sha256', salt).update(password).digest('hex');
  return { hash, salt };
}

// 确保配置目录存在
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

// 检查服务是否在运行
function isRunning() {
  try {
    if (!fs.existsSync(PID_FILE)) return false;
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim());
    // 检查进程是否存在
    process.kill(pid, 0);
    return pid;
  } catch {
    // 进程不存在，清理 PID 文件
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
    }
    return false;
  }
}

// 获取本机 IP
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// 启动服务
async function startServer() {
  const pid = isRunning();
  const ip = getLocalIP();
  
  if (pid) {
    console.log(`\n⚠️  服务已在运行 (PID: ${pid})\n`);
    showAddresses(ip);
    return;
  }

  ensureConfigDir();

  // 检查是否设置了密码
  if (!fs.existsSync(PASSWORD_FILE)) {
    console.log('\n🔐 首次启动，请设置连接密码\n');
    await setPassword();
  }

  console.log('\n🚀 正在启动 LAN Bridge...\n');

  // 后台启动服务
  const logStream = fs.openSync(LOG_FILE, 'a');
  const child = spawn('node', [SERVER_SCRIPT], {
    detached: true,
    stdio: ['ignore', logStream, logStream],
    env: { ...process.env, LAN_BRIDGE_DAEMON: '1' }
  });

  // 保存 PID
  fs.writeFileSync(PID_FILE, String(child.pid));
  child.unref();

  // 等待启动
  await new Promise(resolve => setTimeout(resolve, 2000));

  if (isRunning()) {
    console.log('✅ 服务启动成功!\n');
    showAddresses(ip);
    console.log(`   日志文件: ${LOG_FILE}\n`);
    console.log('   使用 "lan-bridge stop" 停止服务\n');
  } else {
    console.log('❌ 启动失败，请查看日志:\n');
    console.log(`   ${LOG_FILE}\n`);
  }
}

// 显示访问地址
function showAddresses(ip) {
  console.log('📱 客户端访问:');
  console.log(`   http://${ip}:${PORT}/client\n`);
  console.log('🖥️  服务端控制台:');
  console.log(`   http://${ip}:${PORT}/server\n`);
}

// 停止服务
function stopServer() {
  const pid = isRunning();
  if (!pid) {
    console.log('\n⚠️  服务未在运行\n');
    return;
  }

  try {
    process.kill(pid, 'SIGTERM');
    fs.unlinkSync(PID_FILE);
    console.log('\n✅ 服务已停止\n');
  } catch (error) {
    console.log(`\n❌ 停止失败: ${error.message}\n`);
  }
}

// 查看状态
function showStatus() {
  const pid = isRunning();
  console.log('\n📊 LAN Bridge 状态\n');
  
  if (pid) {
    const ip = getLocalIP();
    console.log(`   状态: 🟢 运行中 (PID: ${pid})`);
    console.log(`   地址: http://${ip}:9527`);
  } else {
    console.log('   状态: 🔴 未运行');
  }

  // 显示密码状态
  if (fs.existsSync(PASSWORD_FILE)) {
    const data = JSON.parse(fs.readFileSync(PASSWORD_FILE, 'utf8'));
    console.log(`   密码: 已设置 (${data.updatedAt ? '更新于 ' + data.updatedAt.split('T')[0] : ''})`);
  } else {
    console.log('   密码: 未设置');
  }

  console.log('');
}

// 设置密码
async function setPassword() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('请输入新密码: ', (password) => {
      if (password.trim()) {
        ensureConfigDir();
        const { hash, salt } = hashPassword(password.trim());
        fs.writeFileSync(PASSWORD_FILE, JSON.stringify({
          hash,
          salt,
          updatedAt: new Date().toISOString()
        }));
        console.log('\n✅ 密码设置成功\n');
        
        // 如果服务正在运行，提示需要重启
        if (isRunning()) {
          console.log('⚠️  密码已更改，需要重启服务生效\n');
          console.log('   运行: lan-bridge stop && lan-bridge start\n');
        }
      } else {
        console.log('\n❌ 密码不能为空\n');
      }
      rl.close();
      resolve();
    });
  });
}

// 查看日志
function showLogs() {
  if (!fs.existsSync(LOG_FILE)) {
    console.log('\n⚠️  暂无日志\n');
    return;
  }

  console.log('\n📋 最近日志:\n');
  try {
    const logs = execSync(`tail -50 "${LOG_FILE}"`, { encoding: 'utf8' });
    console.log(logs);
  } catch {
    console.log(fs.readFileSync(LOG_FILE, 'utf8').slice(-5000));
  }
}

// 显示帮助
function showHelp() {
  console.log(`
🌉 LAN Bridge CLI

用法: lan-bridge <命令>

命令:
  start     启动服务（后台运行）
  stop      停止服务
  status    查看服务状态
  password  修改连接密码
  logs      查看日志
  help      显示此帮助

示例:
  lan-bridge start      # 启动服务
  lan-bridge stop       # 停止服务
  lan-bridge password   # 修改密码
`);
}

// 主函数
async function main() {
  const command = process.argv[2];

  switch (command) {
    case 'start':
      await startServer();
      break;
    case 'stop':
      stopServer();
      break;
    case 'status':
      showStatus();
      break;
    case 'password':
    case 'passwd':
    case 'changepassword':
      await setPassword();
      break;
    case 'logs':
    case 'log':
      showLogs();
      break;
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;
    default:
      if (command) {
        console.log(`\n❌ 未知命令: ${command}\n`);
      }
      showHelp();
  }
}

main().catch(console.error);
