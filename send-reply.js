#!/usr/bin/env node
/**
 * 发送 AI 回复到手机
 * 用法: node send-reply.js "回复内容" [--port=端口号]
 */

const WebSocket = require('ws');
const os = require('os');
const path = require('path');

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

// 端口配置：命令行参数 > 环境变量 > 默认值
function getPort() {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--port=')) {
      return parseInt(args[i].split('=')[1], 10);
    }
    if ((args[i] === '--port' || args[i] === '-p') && args[i + 1]) {
      return parseInt(args[i + 1], 10);
    }
  }
  if (process.env.PORT) {
    return parseInt(process.env.PORT, 10);
  }
  return 9527;
}

// 获取消息内容（排除端口参数）
function getMessage() {
  const args = process.argv.slice(2);
  for (const arg of args) {
    if (!arg.startsWith('--') && !arg.startsWith('-p')) {
      return arg;
    }
  }
  return null;
}

const message = getMessage();
if (!message) {
  console.error('用法: node send-reply.js "回复内容" [--port=端口号]');
  process.exit(1);
}

const PORT = getPort();
const ip = getLocalIP();

// 尝试加载 auth 模块获取 token
let authToken = '';
try {
  const auth = require('./lib/auth');
  // 注意：这里无法获取服务器的 session token，因为每次启动都是随机的
  // send-reply 需要通过本地 WebSocket 连接（不需要 token）
  // 我们添加一个特殊标识，让服务器识别这是本地回复
} catch (e) {
  // auth 模块不可用，忽略
}

// WebSocket 连接（本地连接不需要 token，使用特殊标识）
const ws = new WebSocket(`ws://${ip}:${PORT}?local=true`);

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'ai_reply',
    summary: message,
    content: message,
    timestamp: Date.now(),
    isLocalReply: true  // 标识这是本地回复
  }));
  console.log('✅ 已发送到手机:', message.substring(0, 50) + (message.length > 50 ? '...' : ''));
  ws.close();
});

ws.on('error', (err) => {
  console.error('❌ 连接失败:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.error('❌ 连接超时');
  process.exit(1);
}, 5000);
