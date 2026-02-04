#!/usr/bin/env node
/**
 * LAN Bridge - 内网桥接工具
 * 支持文本同步、文件传输、剪贴板操作
 * 
 * 使用方法：
 *   node server.js [--port=端口号]
 *   npx lan-bridge
 *   lan-bridge (全局安装后)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const os = require('os');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const mime = require('mime-types');

// 导入模块
const auth = require('./lib/auth');
const clipboard = require('./lib/clipboard');
const fileManager = require('./lib/file-manager');
const chatStore = require('./lib/chat-store');

// 端口配置：命令行参数 > 环境变量 > 自动查找
function getPreferredPort() {
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
  return 9527; // 默认首选端口
}

// 实际使用的端口（服务器启动后更新）
let PORT = getPreferredPort();

// 当前同步的文本内容
let currentText = '';

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

// 获取 AI 回复的 prompt 后缀
function getSummaryPromptSuffix() {
  const portArg = PORT !== 9527 ? ` --port=${PORT}` : '';
  return `

【重要：完成任务后，请执行以下命令将回复发送到我的手机：
cd ${__dirname} && node send-reply.js "你的简短回复摘要（不超过50字）"${portArg}
】`;
}

// 包装 prompt，添加摘要请求
function wrapPromptWithSummaryRequest(text) {
  return text + getSummaryPromptSuffix();
}

// 所有连接的客户端
let clients = new Set();

// 广播消息给所有客户端
function broadcast(message) {
  const data = JSON.stringify(message);
  clients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(data);
    }
  });
}

// 处理消息
async function handleMessage(ws, data) {
  try {
    const message = JSON.parse(data.toString());
    const time = new Date().toLocaleTimeString('zh-CN');
    
    switch (message.type) {
      case 'sync_text':
        currentText = message.content || '';
        console.log(`[${time}] 📝 已同步文本: ${currentText.substring(0, 50)}${currentText.length > 50 ? '...' : ''}`);
        ws.send(JSON.stringify({ type: 'ack', action: 'sync_text' }));
        break;
        
      case 'paste_only':
        const pasteNeedAiReply = message.needAiReply === true;
        console.log(`[${time}] 📋 执行粘贴${pasteNeedAiReply ? '（需AI回复）' : ''}`);
        
        if (currentText.trim()) {
          const contentToWrite = pasteNeedAiReply 
            ? wrapPromptWithSummaryRequest(currentText) 
            : currentText;
          await clipboard.writeClipboard(contentToWrite);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        await clipboard.doPaste();
        ws.send(JSON.stringify({ type: 'ack', action: 'paste_only' }));
        break;
        
      case 'submit':
        const submitNeedAiReply = message.needAiReply === true;
        console.log(`[${time}] 🚀 粘贴并发送${submitNeedAiReply ? '（需AI回复）' : ''}`);
        
        // 保存用户消息到聊天记录
        if (currentText.trim()) {
          chatStore.saveMessage({ role: 'user', content: currentText });
          
          const contentToWrite = submitNeedAiReply 
            ? wrapPromptWithSummaryRequest(currentText) 
            : currentText;
          await clipboard.writeClipboard(contentToWrite);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        await clipboard.doPaste();
        await new Promise(resolve => setTimeout(resolve, 50));
        await clipboard.simulateEnter();
        currentText = '';
        ws.send(JSON.stringify({ type: 'ack', action: 'submit' }));
        break;
        
      case 'get_clipboard':
        console.log(`[${time}] 📋 获取剪贴板`);
        const clipboardContent = await clipboard.readClipboard();
        ws.send(JSON.stringify({ 
          type: 'clipboard_content', 
          content: clipboardContent,
          timestamp: Date.now()
        }));
        break;
        
      case 'get_current_line':
        console.log(`[${time}] 📋 获取当前行`);
        await clipboard.simulateCopyLine();
        await new Promise(resolve => setTimeout(resolve, 100));
        const lineContent = await clipboard.readClipboard();
        ws.send(JSON.stringify({ 
          type: 'current_line_content', 
          content: lineContent.trim(),
          timestamp: Date.now()
        }));
        break;
        
      case 'replace_line':
        console.log(`[${time}] 🔄 替换当前行`);
        await clipboard.simulateClearLine();
        await new Promise(resolve => setTimeout(resolve, 50));
        await clipboard.doPaste();
        ws.send(JSON.stringify({ type: 'ack', action: 'replace_line' }));
        break;
        
      case 'get_chat_history':
        console.log(`[${time}] 💬 获取聊天记录`);
        const messages = chatStore.getRecentMessages(message.limit || 50);
        ws.send(JSON.stringify({ 
          type: 'chat_history', 
          messages,
          timestamp: Date.now()
        }));
        break;
        
      case 'clear_chat':
        console.log(`[${time}] 🗑️ 清空聊天记录`);
        chatStore.clearTodayMessages();
        ws.send(JSON.stringify({ type: 'ack', action: 'clear_chat' }));
        break;
        
      case 'get_files':
        console.log(`[${time}] 📁 获取文件列表`);
        const files = fileManager.getFileList(message.category || 'all');
        ws.send(JSON.stringify({ 
          type: 'file_list', 
          files,
          timestamp: Date.now()
        }));
        break;
        
      case 'delete_file':
        console.log(`[${time}] 🗑️ 删除文件: ${message.filename}`);
        const deleted = fileManager.deleteFile(message.filename, message.category);
        ws.send(JSON.stringify({ 
          type: 'ack', 
          action: 'delete_file',
          success: deleted
        }));
        break;
        
      default:
        console.log(`[${time}] ❓ 未知消息类型: ${message.type}`);
        ws.send(JSON.stringify({ type: 'error', message: `未知消息类型: ${message.type}` }));
    }
  } catch (error) {
    console.error('处理消息失败:', error.message);
    ws.send(JSON.stringify({ type: 'error', message: error.message }));
  }
}

// 解析 multipart/form-data
function parseMultipart(buffer, boundary) {
  const parts = [];
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const endBoundaryBuffer = Buffer.from(`--${boundary}--`);
  
  let start = 0;
  let end = buffer.indexOf(boundaryBuffer, start);
  
  while (end !== -1) {
    start = end + boundaryBuffer.length + 2; // +2 for CRLF
    end = buffer.indexOf(boundaryBuffer, start);
    
    if (end === -1) {
      end = buffer.indexOf(endBoundaryBuffer, start);
    }
    
    if (end === -1 || start >= end) break;
    
    const part = buffer.slice(start, end - 2); // -2 for CRLF before boundary
    const headerEnd = part.indexOf('\r\n\r\n');
    
    if (headerEnd === -1) continue;
    
    const headerPart = part.slice(0, headerEnd).toString('utf8');
    const bodyPart = part.slice(headerEnd + 4);
    
    // 解析 headers
    const headers = {};
    headerPart.split('\r\n').forEach(line => {
      const match = line.match(/^(.+?):\s*(.+)$/);
      if (match) {
        headers[match[1].toLowerCase()] = match[2];
      }
    });
    
    // 解析 Content-Disposition
    const disposition = headers['content-disposition'] || '';
    const nameMatch = disposition.match(/name="([^"]+)"/);
    const filenameMatch = disposition.match(/filename="([^"]+)"/);
    
    parts.push({
      name: nameMatch ? nameMatch[1] : '',
      filename: filenameMatch ? filenameMatch[1] : '',
      contentType: headers['content-type'] || 'application/octet-stream',
      data: bodyPart
    });
  }
  
  return parts;
}

// 创建 HTTP 服务器
function createHttpServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const token = url.searchParams.get('token');
    
    // CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    
    // 根路径 - 显示二维码页面或客户端页面
    if (pathname === '/' || pathname === '/index.html') {
      const hasValidToken = token && auth.validateToken(token);
      
      if (hasValidToken) {
        // 有效 token，显示客户端页面
        const htmlPath = path.join(__dirname, 'web', 'index.html');
        fs.readFile(htmlPath, 'utf8', (err, data) => {
          if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('页面未找到');
            return;
          }
          // 注入 token
          const injectedHtml = data.replace(
            '</head>',
            `<script>window.AUTH_TOKEN = "${token}";</script></head>`
          );
          res.writeHead(200, { 
            'Content-Type': 'text/html; charset=utf-8',
            'Set-Cookie': `token=${token}; Path=/; SameSite=Strict`
          });
          res.end(injectedHtml);
        });
      } else {
        // 无 token 或无效 token，显示二维码页面
        await serveQRCodePage(req, res);
      }
      return;
    }
    
    // API: 生成二维码图片
    if (pathname === '/api/qrcode') {
      try {
        const ip = getLocalIP();
        const secureUrl = auth.generateSecureUrl(`http://${ip}:${PORT}`);
        const qrDataUrl = await QRCode.toDataURL(secureUrl, {
          width: 256,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' }
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          qrcode: qrDataUrl, 
          url: secureUrl,
          connections: clients.size
        }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }
    
    // 以下 API 需要 token 验证
    if (!auth.validateRequest(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '未授权访问' }));
      return;
    }
    
    // 文件上传
    if (pathname === '/api/upload' && req.method === 'POST') {
      const contentType = req.headers['content-type'] || '';
      const boundaryMatch = contentType.match(/boundary=(.+)$/);
      
      if (!boundaryMatch) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '无效的请求格式' }));
        return;
      }
      
      const boundary = boundaryMatch[1];
      const chunks = [];
      
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        try {
          const buffer = Buffer.concat(chunks);
          const parts = parseMultipart(buffer, boundary);
          
          const results = [];
          parts.forEach(part => {
            if (part.filename) {
              const result = fileManager.saveFile(
                part.data, 
                part.filename, 
                part.contentType
              );
              results.push(result);
              console.log(`[${new Date().toLocaleTimeString('zh-CN')}] 📤 上传文件: ${part.filename} (${result.category})`);
            }
          });
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, files: results }));
        } catch (error) {
          console.error('文件上传失败:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }
    
    // 文件下载
    if (pathname.startsWith('/files/')) {
      const filename = decodeURIComponent(pathname.slice(7));
      const category = url.searchParams.get('category');
      const filePath = fileManager.getFilePath(filename, category);
      
      if (filePath && fs.existsSync(filePath)) {
        const mimeType = mime.lookup(filePath) || 'application/octet-stream';
        const stat = fs.statSync(filePath);
        
        res.writeHead(200, {
          'Content-Type': mimeType,
          'Content-Length': stat.size,
          'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`
        });
        
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '文件不存在' }));
      }
      return;
    }
    
    // API: 获取文件列表
    if (pathname === '/api/files') {
      const category = url.searchParams.get('category') || 'all';
      const files = fileManager.getFileList(category);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ files }));
      return;
    }
    
    // API: 删除文件
    if (pathname === '/api/files/delete' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const { filename, category } = JSON.parse(body);
          const success = fileManager.deleteFile(filename, category);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success }));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }
    
    // API: 获取聊天记录
    if (pathname === '/api/chats') {
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const messages = chatStore.getRecentMessages(limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ messages }));
      return;
    }
    
    // API: 获取存储统计
    if (pathname === '/api/stats') {
      const fileStats = fileManager.getStats();
      const chatStats = chatStore.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ files: fileStats, chats: chatStats }));
      return;
    }
    
    // 404
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  });
}

// 生成二维码页面（服务端显示）
async function serveQRCodePage(req, res) {
  const ip = getLocalIP();
  const secureUrl = auth.generateSecureUrl(`http://${ip}:${PORT}`);
  
  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(secureUrl, {
      width: 280,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    });
  } catch (error) {
    console.error('生成二维码失败:', error);
  }
  
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LAN Bridge - 扫码连接</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 24px;
      padding: 40px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 400px;
      width: 100%;
    }
    h1 {
      font-size: 28px;
      color: #1a1a2e;
      margin-bottom: 8px;
    }
    .subtitle {
      color: #666;
      font-size: 14px;
      margin-bottom: 30px;
    }
    .qr-container {
      background: #f8f9fa;
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .qr-container img {
      width: 240px;
      height: 240px;
      border-radius: 8px;
    }
    .status {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 20px;
      background: #e8f5e9;
      border-radius: 12px;
      color: #2e7d32;
      font-size: 14px;
      margin-bottom: 20px;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      background: #4caf50;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .connections {
      font-size: 13px;
      color: #888;
    }
    .tip {
      margin-top: 20px;
      padding: 16px;
      background: #fff3e0;
      border-radius: 12px;
      font-size: 13px;
      color: #e65100;
    }
    .refresh-btn {
      margin-top: 16px;
      padding: 10px 24px;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .refresh-btn:hover {
      background: #5a6fd6;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>🌉 LAN Bridge</h1>
    <p class="subtitle">内网桥接工具 - 扫码连接</p>
    
    <div class="qr-container">
      <img id="qrcode" src="${qrDataUrl}" alt="扫码连接">
    </div>
    
    <div class="status">
      <span class="status-dot"></span>
      <span>服务运行中</span>
    </div>
    
    <p class="connections">当前连接数: <span id="connCount">${clients.size}</span></p>
    
    <div class="tip">
      📱 使用手机浏览器扫描二维码连接<br>
      ⚠️ 请确保手机和电脑在同一网络
    </div>
    
    <button class="refresh-btn" onclick="refreshQR()">🔄 刷新二维码</button>
  </div>
  
  <script>
    async function refreshQR() {
      try {
        const res = await fetch('/api/qrcode');
        const data = await res.json();
        document.getElementById('qrcode').src = data.qrcode;
        document.getElementById('connCount').textContent = data.connections;
      } catch (e) {
        console.error('刷新失败:', e);
      }
    }
    
    // 每 5 秒自动刷新连接数
    setInterval(async () => {
      try {
        const res = await fetch('/api/qrcode');
        const data = await res.json();
        document.getElementById('connCount').textContent = data.connections;
      } catch (e) {}
    }, 5000);
  </script>
</body>
</html>`;

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

// 显示启动信息和二维码
function showStartupInfo(ip, port) {
  const secureUrl = auth.generateSecureUrl(`http://${ip}:${port}`);
  const webUrl = `http://${ip}:${port}`;
  
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║            🌉 LAN Bridge - 内网桥接工具            ║');
  console.log('║       文本同步 | 文件传输 | 剪贴板操作             ║');
  console.log('╠═══════════════════════════════════════════════════╣');
  console.log(`║  服务地址: ${webUrl.padEnd(38)}║`);
  console.log(`║  数据目录: ~/Documents/lan-bridge/                 ║`);
  console.log('╚═══════════════════════════════════════════════════╝');
  console.log('\n📱 手机扫描下方二维码连接（含加密 token）:\n');
  qrcode.generate(secureUrl, { small: true });
  console.log('\n💡 或在浏览器打开上述地址查看二维码页面');
  console.log(`\n📤 发送AI回复: node send-reply.js "内容"${port !== 9527 ? ` --port=${port}` : ''}`);
  console.log('\n按 Ctrl+C 停止服务\n');
  console.log('─'.repeat(50));
}

// 设置 WebSocket 服务器
function setupWebSocket(server) {
  const wss = new WebSocketServer({ server });
  
  wss.on('connection', (ws, req) => {
    // 验证 WebSocket 连接的 token
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const isLocal = url.searchParams.get('local') === 'true';
    
    // 本地连接（来自 send-reply.js）允许不带 token
    // 检查是否为本地回环地址
    const clientIP = req.socket.remoteAddress;
    const isLocalConnection = clientIP === '127.0.0.1' || 
                              clientIP === '::1' || 
                              clientIP === '::ffff:127.0.0.1' ||
                              clientIP?.includes('192.168.') ||
                              clientIP?.includes('10.') ||
                              clientIP?.includes('172.');
    
    if (!auth.validateToken(token) && !(isLocal && isLocalConnection)) {
      console.log('\n❌ WebSocket 连接被拒绝: 无效的 token\n');
      ws.close(4001, '未授权');
      return;
    }
    
    clients.add(ws);
    console.log('\n✅ 客户端已连接! (当前连接数:', clients.size, ')\n');
    currentText = '';
    
    // 发送历史聊天记录
    const messages = chatStore.getRecentMessages(50);
    ws.send(JSON.stringify({ type: 'chat_history', messages }));
    
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ai_reply') {
          const time = new Date().toLocaleTimeString('zh-CN');
          console.log(`[${time}] 🤖 AI回复: ${msg.summary?.substring(0, 50)}...`);
          // 保存 AI 回复到聊天记录
          chatStore.saveMessage({ role: 'ai', content: msg.summary || msg.content });
          broadcast(msg);
        } else {
          handleMessage(ws, data);
        }
      } catch (e) {
        handleMessage(ws, data);
      }
    });
    
    ws.on('close', () => {
      clients.delete(ws);
      console.log('\n❌ 客户端已断开 (当前连接数:', clients.size, ')\n');
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket 错误:', error.message);
      clients.delete(ws);
    });
  });
  
  return wss;
}

// 尝试在指定端口启动服务器
function tryListen(server, port, maxAttempts = 10) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const tryPort = (currentPort) => {
      attempts++;
      
      server.once('error', (error) => {
        if (error.code === 'EADDRINUSE' && attempts < maxAttempts) {
          tryPort(currentPort + 1);
        } else if (error.code === 'EADDRINUSE') {
          reject(new Error(`无法找到可用端口（尝试了 ${port} - ${currentPort}）`));
        } else {
          reject(error);
        }
      });
      
      server.once('listening', () => {
        resolve(currentPort);
      });
      
      server.listen(currentPort);
    };
    
    tryPort(port);
  });
}

// 启动服务器
async function startServer() {
  // 初始化模块
  auth.init();
  fileManager.init();
  chatStore.init();
  
  const ip = getLocalIP();
  const server = createHttpServer();
  
  try {
    const actualPort = await tryListen(server, getPreferredPort());
    PORT = actualPort;
    
    showStartupInfo(ip, actualPort);
    setupWebSocket(server);
  } catch (error) {
    console.error(`\n❌ 启动失败: ${error.message}\n`);
    process.exit(1);
  }
}

// 检查依赖
try {
  require('ws');
  require('qrcode-terminal');
  require('qrcode');
  require('mime-types');
} catch (e) {
  console.log('正在安装依赖...');
  const { execSync } = require('child_process');
  execSync('npm install', { stdio: 'inherit', cwd: __dirname });
  console.log('依赖安装完成，请重新运行\n');
  process.exit(0);
}

// 导出供外部使用
module.exports = { startServer };

// 直接运行时启动服务器
if (require.main === module) {
  startServer();
}
