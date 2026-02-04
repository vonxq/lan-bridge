#!/usr/bin/env node
/**
 * LAN Bridge v2 - 内网桥接工具
 * 支持文本同步、文件传输、剪贴板操作、用户管理
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
const userManager = require('./lib/user-manager');

// 端口配置
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
  return 9527;
}

let PORT = getPreferredPort();
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

// AI 回复 prompt 后缀
function getSummaryPromptSuffix() {
  const portArg = PORT !== 9527 ? ` --port=${PORT}` : '';
  return `

【重要：完成任务后，请执行以下命令将回复发送到我的手机：
cd ${__dirname} && node send-reply.js "你的简短回复摘要（不超过50字）"${portArg}
】`;
}

function wrapPromptWithSummaryRequest(text) {
  return text + getSummaryPromptSuffix();
}

// 所有客户端
let clients = new Set();

// 广播消息
function broadcast(message, excludeWs = null) {
  const data = JSON.stringify(message);
  clients.forEach(client => {
    if (client.readyState === 1 && client !== excludeWs) {
      client.send(data);
    }
  });
}

// 广播用户列表
function broadcastUserList() {
  const users = userManager.getOnlineUsers();
  broadcast({ type: 'user_list', users });
}

// 处理消息
async function handleMessage(ws, data) {
  try {
    const message = JSON.parse(data.toString());
    const time = new Date().toLocaleTimeString('zh-CN');
    const user = userManager.getUserByWs(ws);
    
    // 更新活跃时间
    userManager.updateActivity(ws);
    
    switch (message.type) {
      case 'sync_text':
        currentText = message.content || '';
        console.log(`[${time}] 📝 ${user?.name || '未知'} 同步文本`);
        ws.send(JSON.stringify({ type: 'ack', action: 'sync_text' }));
        break;
        
      case 'paste_only': {
        const needAiReply = message.needAiReply === true;
        console.log(`[${time}] 📋 ${user?.name || '未知'} 执行粘贴`);
        
        if (currentText.trim()) {
          const content = needAiReply ? wrapPromptWithSummaryRequest(currentText) : currentText;
          await clipboard.writeClipboard(content);
          await new Promise(r => setTimeout(r, 100));
        }
        
        await clipboard.doPaste();
        
        // 记录活动
        if (user) {
          userManager.addActivity(user.id, 'paste', currentText.substring(0, 50), { 
            fullContent: currentText,
            aiReply: needAiReply 
          });
        }
        
        ws.send(JSON.stringify({ type: 'ack', action: 'paste_only' }));
        break;
      }
        
      case 'submit': {
        const needAiReply = message.needAiReply === true;
        console.log(`[${time}] 🚀 ${user?.name || '未知'} 粘贴并发送`);
        
        if (currentText.trim()) {
          // 保存聊天记录
          const chatMsg = chatStore.saveMessage({ 
            role: 'user', 
            content: currentText,
            userId: user?.id,
            userName: user?.name,
            userAvatar: user?.avatar,
          });
          
          // 广播新消息
          broadcast({ 
            type: 'new_chat_message', 
            message: chatMsg 
          });
          
          const content = needAiReply ? wrapPromptWithSummaryRequest(currentText) : currentText;
          await clipboard.writeClipboard(content);
          await new Promise(r => setTimeout(r, 100));
          
          // 记录活动
          if (user) {
            userManager.addActivity(user.id, 'submit', currentText.substring(0, 50), {
              fullContent: currentText,
              aiReply: needAiReply
            });
          }
        }
        
        await clipboard.doPaste();
        await new Promise(r => setTimeout(r, 50));
        await clipboard.simulateEnter();
        currentText = '';
        ws.send(JSON.stringify({ type: 'ack', action: 'submit' }));
        break;
      }
        
      case 'get_clipboard':
        console.log(`[${time}] 📋 ${user?.name || '未知'} 获取剪贴板`);
        const clipContent = await clipboard.readClipboard();
        ws.send(JSON.stringify({ type: 'clipboard_content', content: clipContent, timestamp: Date.now() }));
        break;
        
      case 'get_current_line':
        console.log(`[${time}] 📋 ${user?.name || '未知'} 获取当前行`);
        await clipboard.simulateCopyLine();
        await new Promise(r => setTimeout(r, 100));
        const lineContent = await clipboard.readClipboard();
        ws.send(JSON.stringify({ type: 'current_line_content', content: lineContent.trim(), timestamp: Date.now() }));
        break;
        
      case 'replace_line':
        console.log(`[${time}] 🔄 ${user?.name || '未知'} 替换当前行`);
        await clipboard.simulateClearLine();
        await new Promise(r => setTimeout(r, 50));
        await clipboard.doPaste();
        
        if (user) {
          userManager.addActivity(user.id, 'replace', currentText.substring(0, 50));
        }
        
        ws.send(JSON.stringify({ type: 'ack', action: 'replace_line' }));
        break;
        
      case 'get_chat_history': {
        const limit = message.limit || 50;
        const messages = chatStore.getRecentMessages(limit);
        ws.send(JSON.stringify({ type: 'chat_history', messages, timestamp: Date.now() }));
        break;
      }
        
      case 'clear_chat':
        console.log(`[${time}] 🗑️ ${user?.name || '未知'} 清空聊天记录`);
        chatStore.clearTodayMessages();
        broadcast({ type: 'chat_cleared' });
        ws.send(JSON.stringify({ type: 'ack', action: 'clear_chat' }));
        break;
        
      case 'get_files': {
        const category = message.category || 'all';
        const files = fileManager.getFileList(category);
        ws.send(JSON.stringify({ type: 'file_list', files, timestamp: Date.now() }));
        break;
      }
        
      case 'delete_file': {
        console.log(`[${time}] 🗑️ ${user?.name || '未知'} 删除文件: ${message.filename}`);
        const deleted = fileManager.deleteFile(message.filename, message.category);
        ws.send(JSON.stringify({ type: 'ack', action: 'delete_file', success: deleted }));
        break;
      }
        
      case 'settings_update': {
        console.log(`[${time}] ⚙️ ${user?.name || '未知'} 更新设置`);
        if (message.settings?.maxConnections) {
          userManager.setMaxConnections(message.settings.maxConnections);
        }
        broadcast({ type: 'settings_changed', settings: message.settings });
        break;
      }
        
      case 'kick_user': {
        console.log(`[${time}] 🚫 ${user?.name || '未知'} 踢出用户: ${message.userId}`);
        const kickedUser = userManager.kickUser(message.userId);
        if (kickedUser) {
          broadcast({ type: 'user_kicked', userId: message.userId, userName: kickedUser.name });
          broadcastUserList();
        }
        break;
      }
        
      case 'get_user_activities': {
        const userId = message.userId;
        const activities = userManager.getUserActivities(userId, message.limit || 50);
        ws.send(JSON.stringify({ type: 'user_activities', userId, activities }));
        break;
      }
        
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
    start = end + boundaryBuffer.length + 2;
    end = buffer.indexOf(boundaryBuffer, start);
    
    if (end === -1) {
      end = buffer.indexOf(endBoundaryBuffer, start);
    }
    
    if (end === -1 || start >= end) break;
    
    const part = buffer.slice(start, end - 2);
    const headerEnd = part.indexOf('\r\n\r\n');
    
    if (headerEnd === -1) continue;
    
    const headerPart = part.slice(0, headerEnd).toString('utf8');
    const bodyPart = part.slice(headerEnd + 4);
    
    const headers = {};
    headerPart.split('\r\n').forEach(line => {
      const match = line.match(/^(.+?):\s*(.+)$/);
      if (match) {
        headers[match[1].toLowerCase()] = match[2];
      }
    });
    
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
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    
    // 根路径
    if (pathname === '/' || pathname === '/index.html') {
      const hasValidToken = token && auth.validateToken(token);
      
      if (hasValidToken) {
        // 有效 token，返回客户端页面
        await serveClientPage(res, token);
      } else {
        // 无 token，返回二维码页面
        await serveQRCodePage(res);
      }
      return;
    }
    
    // API: 生成二维码
    if (pathname === '/api/qrcode') {
      try {
        const ip = getLocalIP();
        const secureUrl = auth.generateSecureUrl(`http://${ip}:${PORT}`);
        const qrDataUrl = await QRCode.toDataURL(secureUrl, {
          width: 256,
          margin: 2,
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          qrcode: qrDataUrl, 
          url: secureUrl,
          connections: userManager.getOnlineCount(),
          maxConnections: userManager.getMaxConnections(),
          users: userManager.getOnlineUsers().map(u => ({
            id: u.id,
            name: u.name,
            avatar: u.avatar,
            isOnline: u.isOnline,
          })),
        }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }
    
    // 检查是否是本地请求（服务端控制台）
    const clientIP = req.socket.remoteAddress;
    const isLocalRequest = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(clientIP);
    
    // 以下 API 需要 token 验证（本地请求除外）
    if (!isLocalRequest && !auth.validateRequest(req)) {
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
              const result = fileManager.saveFile(part.data, part.filename, part.contentType);
              results.push(result);
              console.log(`[${new Date().toLocaleTimeString('zh-CN')}] 📤 上传文件: ${part.filename}`);
            }
          });
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, files: results }));
        } catch (error) {
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
          'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
        });
        
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '文件不存在' }));
      }
      return;
    }
    
    // API: 文件列表
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
    
    // API: 聊天记录
    if (pathname === '/api/chats') {
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const messages = chatStore.getRecentMessages(limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ messages }));
      return;
    }
    
    // API: 踢出用户（服务端使用）
    if (pathname === '/api/kick-user' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const { userId } = JSON.parse(body);
          const kickedUser = userManager.kickUser(userId);
          if (kickedUser) {
            broadcast({ type: 'user_kicked', userId, userName: kickedUser.name });
            broadcastUserList();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '用户不存在' }));
          }
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }
    
    // API: 清空聊天（服务端使用）
    if (pathname === '/api/clear-chat' && req.method === 'POST') {
      chatStore.clearTodayMessages();
      broadcast({ type: 'chat_cleared' });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
      return;
    }
    
    // API: 更新设置（服务端使用）
    if (pathname === '/api/settings' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const settings = JSON.parse(body);
          if (settings.maxConnections) {
            userManager.setMaxConnections(settings.maxConnections);
          }
          broadcast({ type: 'settings_changed', settings });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }
    
    // 404
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  });
}

// 服务客户端页面（从 dist 或 web 目录）
async function serveClientPage(res, token) {
  // 优先使用打包后的文件
  let htmlPath = path.join(__dirname, 'dist', 'index.html');
  if (!fs.existsSync(htmlPath)) {
    // 降级到开发模式的文件
    htmlPath = path.join(__dirname, 'web', 'index.html');
  }
  
  if (!fs.existsSync(htmlPath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('页面未找到，请先运行 npm run build');
    return;
  }
  
  let html = fs.readFileSync(htmlPath, 'utf8');
  
  // 注入 token 和配置
  const injectedScript = `<script>
    window.AUTH_TOKEN = "${token}";
    window.IS_SERVER_VIEW = false;
  </script>`;
  html = html.replace('</head>', `${injectedScript}</head>`);
  
  res.writeHead(200, { 
    'Content-Type': 'text/html; charset=utf-8',
    'Set-Cookie': `token=${token}; Path=/; SameSite=Strict`,
  });
  res.end(html);
}

// 服务二维码页面（内联 HTML）
async function serveQRCodePage(res) {
  // 优先使用打包后的文件
  let htmlPath = path.join(__dirname, 'dist', 'index.html');
  if (!fs.existsSync(htmlPath)) {
    htmlPath = path.join(__dirname, 'web', 'index.html');
  }
  
  if (fs.existsSync(htmlPath)) {
    let html = fs.readFileSync(htmlPath, 'utf8');
    
    // 注入服务端标识
    const injectedScript = `<script>
      window.AUTH_TOKEN = "";
      window.IS_SERVER_VIEW = true;
    </script>`;
    html = html.replace('</head>', `${injectedScript}</head>`);
    
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } else {
    // 使用内联的简单二维码页面
    const ip = getLocalIP();
    const secureUrl = auth.generateSecureUrl(`http://${ip}:${PORT}`);
    
    let qrDataUrl = '';
    try {
      qrDataUrl = await QRCode.toDataURL(secureUrl, { width: 280, margin: 2 });
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
    body { font-family: -apple-system, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; }
    .card { background: white; border-radius: 24px; padding: 40px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 400px; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    .subtitle { color: #666; font-size: 14px; margin-bottom: 30px; }
    .qr { background: #f8f9fa; border-radius: 16px; padding: 20px; margin-bottom: 24px; }
    .qr img { width: 240px; height: 240px; }
    .status { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 20px; background: #e8f5e9; border-radius: 12px; color: #2e7d32; font-size: 14px; margin-bottom: 20px; }
    .dot { width: 8px; height: 8px; background: #4caf50; border-radius: 50%; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    .tip { padding: 16px; background: #fff3e0; border-radius: 12px; font-size: 13px; color: #e65100; }
    .btn { margin-top: 16px; padding: 10px 24px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🌉 LAN Bridge</h1>
    <p class="subtitle">内网桥接工具 - 扫码连接</p>
    <div class="qr"><img src="${qrDataUrl}" alt="扫码连接"></div>
    <div class="status"><span class="dot"></span><span>服务运行中</span></div>
    <p style="font-size:13px;color:#888;">当前连接: ${userManager.getOnlineCount()} / ${userManager.getMaxConnections()}</p>
    <div class="tip">📱 使用手机浏览器扫描二维码连接<br>⚠️ 请确保手机和电脑在同一网络</div>
    <button class="btn" onclick="location.reload()">🔄 刷新二维码</button>
  </div>
</body>
</html>`;
    
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  }
}

// 自动打开浏览器
function openBrowser(url) {
  const { exec } = require('child_process');
  
  let command;
  switch (process.platform) {
    case 'darwin':
      command = `open "${url}"`;
      break;
    case 'win32':
      command = `start "" "${url}"`;
      break;
    default:
      command = `xdg-open "${url}"`;
  }
  
  exec(command, (err) => {
    if (err) {
      console.log(`💡 请手动打开浏览器访问: ${url}`);
    }
  });
}

// 显示启动信息
function showStartupInfo(ip, port) {
  const secureUrl = auth.generateSecureUrl(`http://${ip}:${port}`);
  const webUrl = `http://${ip}:${port}`;
  const localUrl = `http://localhost:${port}`;
  
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║          🌉 LAN Bridge v2 - 内网桥接工具           ║');
  console.log('║    文本同步 | 文件传输 | 用户管理 | 快捷方法       ║');
  console.log('╠═══════════════════════════════════════════════════╣');
  console.log(`║  服务地址: ${webUrl.padEnd(38)}║`);
  console.log(`║  本地地址: ${localUrl.padEnd(38)}║`);
  console.log(`║  最大连接: ${String(userManager.getMaxConnections()).padEnd(38)}║`);
  console.log(`║  数据目录: ~/Documents/lan-bridge/${''.padEnd(17)}║`);
  console.log('╚═══════════════════════════════════════════════════╝');
  console.log('\n📱 手机扫描下方二维码连接（含加密 token）:\n');
  qrcode.generate(secureUrl, { small: true });
  console.log(`\n📤 发送AI回复: node send-reply.js "内容"${port !== 9527 ? ` --port=${port}` : ''}`);
  console.log('\n按 Ctrl+C 停止服务\n');
  console.log('─'.repeat(50));
  
  // 自动打开浏览器
  console.log('\n🌐 正在打开服务端控制台...\n');
  openBrowser(localUrl);
}

// 设置 WebSocket
function setupWebSocket(server) {
  const wss = new WebSocketServer({ server });
  
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const isLocal = url.searchParams.get('local') === 'true';
    
    // 本地连接检查
    const clientIP = req.socket.remoteAddress;
    const isLocalConnection = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(clientIP) ||
                              clientIP?.includes('192.168.') ||
                              clientIP?.includes('10.') ||
                              clientIP?.includes('172.');
    
    // Token 验证
    if (!auth.validateToken(token) && !(isLocal && isLocalConnection)) {
      console.log('\n❌ WebSocket 连接被拒绝: 无效的 token\n');
      ws.close(4001, '未授权');
      return;
    }
    
    // 添加用户
    const result = userManager.addUser(ws, token);
    if (result.error) {
      console.log(`\n❌ 连接被拒绝: ${result.error}\n`);
      ws.close(4003, result.error);
      return;
    }
    
    const user = result.user;
    clients.add(ws);
    
    console.log(`\n✅ ${user.name} ${user.avatar} 已连接! (当前: ${userManager.getOnlineCount()}/${userManager.getMaxConnections()})\n`);
    
    // 发送用户信息
    ws.send(JSON.stringify({ type: 'user_info', user }));
    
    // 发送历史聊天记录
    const messages = chatStore.getRecentMessages(50);
    ws.send(JSON.stringify({ type: 'chat_history', messages }));
    
    // 广播新用户
    broadcast({ type: 'user_connected', user }, ws);
    broadcastUserList();
    
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ai_reply') {
          const time = new Date().toLocaleTimeString('zh-CN');
          console.log(`[${time}] 🤖 AI回复: ${msg.summary?.substring(0, 50)}...`);
          
          // 保存 AI 回复
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
      const disconnectedUser = userManager.removeUser(ws);
      clients.delete(ws);
      
      if (disconnectedUser) {
        console.log(`\n❌ ${disconnectedUser.name} ${disconnectedUser.avatar} 已断开 (当前: ${userManager.getOnlineCount()})\n`);
        broadcast({ type: 'user_disconnected', userId: disconnectedUser.id });
        broadcastUserList();
      }
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket 错误:', error.message);
      userManager.removeUser(ws);
      clients.delete(ws);
    });
  });
  
  return wss;
}

// 端口监听
function tryListen(server, port, maxAttempts = 10) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const tryPort = (currentPort) => {
      attempts++;
      
      server.once('error', (error) => {
        if (error.code === 'EADDRINUSE' && attempts < maxAttempts) {
          tryPort(currentPort + 1);
        } else if (error.code === 'EADDRINUSE') {
          reject(new Error(`无法找到可用端口`));
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

module.exports = { startServer };

if (require.main === module) {
  startServer();
}
