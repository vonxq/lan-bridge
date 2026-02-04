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

const crypto = require('crypto');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const os = require('os');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const mime = require('mime-types');
const readline = require('readline');

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

// 密码配置文件路径
const CONFIG_DIR = path.join(os.homedir(), '.lan-bridge');
const PASSWORD_FILE = path.join(CONFIG_DIR, 'password.json');

// 确保配置目录存在
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

// 密码哈希（使用 SHA-256 + salt）
function hashPassword(password, salt = null) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHmac('sha256', salt).update(password).digest('hex');
  return { hash, salt };
}

// 读取保存的密码哈希
function getSavedPasswordData() {
  try {
    if (fs.existsSync(PASSWORD_FILE)) {
      const data = JSON.parse(fs.readFileSync(PASSWORD_FILE, 'utf8'));
      return data.hash ? data : null;
    }
  } catch (e) {
    // 忽略错误
  }
  return null;
}

// 检查是否已设置密码
function hasPassword() {
  return getSavedPasswordData() !== null;
}

// 保存密码（哈希存储）
function savePassword(password) {
  ensureConfigDir();
  const { hash, salt } = hashPassword(password);
  fs.writeFileSync(PASSWORD_FILE, JSON.stringify({ 
    hash, 
    salt,
    updatedAt: new Date().toISOString() 
  }));
}

// 验证密码
function validatePassword(inputPassword) {
  const data = getSavedPasswordData();
  if (!data || !data.hash || !data.salt) return false;
  const { hash } = hashPassword(inputPassword, data.salt);
  return hash === data.hash;
}

// 提示用户输入密码
async function promptForPassword() {
  const passwordSet = hasPassword();
  
  // 后台模式（通过 CLI 启动）时，跳过交互
  if (process.env.LAN_BRIDGE_DAEMON === '1') {
    if (!passwordSet) {
      console.error('❌ 未设置密码，请先运行: lan-bridge password');
      process.exit(1);
    }
    return true;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    if (passwordSet) {
      console.log('\n📌 已设置连接密码');
      rl.question('是否重新设置密码? (y/N): ', (answer) => {
        if (answer.toLowerCase() === 'y') {
          rl.question('请输入新密码: ', (password) => {
            if (password.trim()) {
              savePassword(password.trim());
              console.log('✅ 密码已更新');
            }
            rl.close();
            resolve(true);
          });
        } else {
          rl.close();
          resolve(true);
        }
      });
    } else {
      console.log('\n🔐 首次启动，请设置连接密码');
      rl.question('请输入密码: ', (password) => {
        if (password.trim()) {
          savePassword(password.trim());
          console.log('✅ 密码设置成功');
          rl.close();
          resolve(true);
        } else {
          console.log('❌ 密码不能为空');
          rl.close();
          resolve(promptForPassword()); // 递归重试
        }
      });
    }
  });
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

// 广播消息（仅用于用户列表等公共信息）
function broadcast(message, excludeWs = null) {
  const data = JSON.stringify(message);
  clients.forEach(client => {
    if (client.readyState === 1 && client !== excludeWs) {
      client.send(data);
    }
  });
}

// 发送消息给指定用户
function sendToUser(userId, message) {
  const user = userManager.getUserById(userId);
  if (user && user.ws && user.ws.readyState === 1) {
    user.ws.send(JSON.stringify(message));
  }
}

// 发送消息给所有服务端控制台
function sendToServers(message) {
  const data = JSON.stringify(message);
  clients.forEach(client => {
    if (client.readyState === 1 && client.isServerView) {
      client.send(data);
    }
  });
}

// 发送聊天消息（定向发送）
function sendChatMessage(chatMsg) {
  // 发送给消息发送者（客户端）
  if (chatMsg.userId) {
    sendToUser(chatMsg.userId, { type: 'new_chat_message', message: chatMsg });
  }
  
  // 发送给所有服务端控制台
  sendToServers({ type: 'new_chat_message', message: chatMsg });
}

// 广播用户列表
function broadcastUserList() {
  const users = userManager.getOnlineUsers().map(u => {
    const { ws, ...userInfo } = u;
    return userInfo;
  });
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
          
          // 定向发送消息（发送者 + 服务端）
          sendChatMessage(chatMsg);
          
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

// 请求处理函数（HTTP 和 HTTPS 共用）
async function handleRequest(req, res) {
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

  // 调用原有的处理逻辑
  await handleRequestInternal(req, res, url, pathname, token);
}

// 创建 HTTP 服务器
function createHttpServer() {
  return http.createServer(handleRequest);
}

// 内部请求处理逻辑
async function handleRequestInternal(req, res, url, pathname, token) {
    // 服务端入口
    if (pathname === '/server' || pathname === '/server/') {
      const serverToken = url.searchParams.get('server_token');
      const hasValidServerToken = serverToken && auth.validateServerToken(serverToken);
      
      if (hasValidServerToken) {
        await serveServerPage(res, serverToken);
      } else {
        // 无效 token，显示登录页面（可用密码获取 token）
        await serveClientPage(res, '', true);  // isServerLogin = true
      }
      return;
    }
    
    // 客户端入口
    if (pathname === '/' || pathname === '/index.html' || pathname === '/client' || pathname === '/client/') {
      const hasValidClientToken = token && auth.validateToken(token);
      // 返回客户端页面（前端会检查 token 有效性，无效时显示登录页面）
      await serveClientPage(res, hasValidClientToken ? token : '');
      return;
    }
    
    // API: 密码验证登录
    if (pathname === '/api/login' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const { password, type } = JSON.parse(body);
          if (validatePassword(password)) {
            // 密码正确，根据类型返回不同 token
            if (type === 'server') {
              // 服务端登录，返回 server_token
              const serverToken = auth.getServerToken();
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, serverToken, redirect: `/server?server_token=${serverToken}` }));
            } else {
              // 客户端登录，返回 client token
              const token = auth.generateClientToken();
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, token }));
            }
          } else {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: '密码错误' }));
          }
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '请求格式错误' }));
        }
      });
      return;
    }
    
    // API: 生成二维码（带 token，扫码直接连接）
    if (pathname === '/api/qrcode') {
      try {
        const ip = getLocalIP();
        const secureUrl = auth.generateSecureUrl(`http://${ip}:${PORT}`);
        const qrDataUrl = await QRCode.toDataURL(secureUrl, {
          width: 180,  // 调小二维码
          margin: 1,
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
      // 验证token
      if (!token || !auth.validateToken(token)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '未授权' }));
        return;
      }
      
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
          
          // 找到上传用户（通过token找到对应的WebSocket连接，再找到用户）
          let uploadUser = null;
          const onlineUsers = userManager.getOnlineUsers();
          for (const user of onlineUsers) {
            if (user.token === token) {
              uploadUser = user;
              break;
            }
          }
          
          const results = [];
          const time = new Date().toLocaleTimeString('zh-CN');
          
          parts.forEach(part => {
            if (part.filename) {
              const result = fileManager.saveFile(part.data, part.filename, part.contentType);
              results.push(result);
              console.log(`[${time}] 📤 ${uploadUser?.name || '未知'} 上传文件: ${part.filename}`);
              
              // 创建文件消息
              const messageType = result.category === 'images' ? 'image' : result.category === 'videos' ? 'video' : 'file';
              const fileMsg = chatStore.saveMessage({
                role: 'user',
                content: `上传文件: ${part.filename}`,
                userId: uploadUser?.id,
                userName: uploadUser?.name || '未知',
                userAvatar: uploadUser?.avatar || '👤',
                messageType: messageType,
                file: {
                  filename: result.filename,
                  size: part.data.length,
                  category: result.category,
                },
              });
              
              console.log(`[DEBUG] 客户端上传文件消息:`, JSON.stringify(fileMsg, null, 2));
              
              // 发送给上传者和所有服务端控制台
              sendChatMessage(fileMsg);
            }
          });
          
          // 广播文件列表更新
          const allFiles = fileManager.getFileList('all');
          broadcast({ type: 'file_list', files: allFiles, timestamp: Date.now() });
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, files: results }));
        } catch (error) {
          console.error('[ERROR] 文件上传失败:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }
    
    // 文件下载
    if (pathname.startsWith('/files/')) {
      const filename = decodeURIComponent(pathname.slice(7));
      const category = url.searchParams.get('category') || 'files';
      console.log(`[DEBUG] 请求文件: filename=${filename}, category=${category}`);
      const filePath = fileManager.getFilePath(filename, category);
      console.log(`[DEBUG] 文件路径: ${filePath}, 存在: ${filePath ? fs.existsSync(filePath) : false}`);
      
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
          
          // 广播文件列表更新
          if (success) {
            const allFiles = fileManager.getFileList('all');
            broadcast({ type: 'file_list', files: allFiles, timestamp: Date.now() });
          }
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success }));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }
    
    // API: 在 Finder 中打开文件（仅服务端可用）
    if (pathname === '/api/open-in-finder' && req.method === 'POST') {
      // 只允许本地请求
      if (!isLocalRequest) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '此操作仅限服务端使用' }));
        return;
      }
      
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const { filename, category } = JSON.parse(body);
          const filepath = fileManager.getFilePath(filename, category);
          
          if (!filepath || !fs.existsSync(filepath)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '文件不存在' }));
            return;
          }
          
          // 在 Finder/文件管理器中定位文件
          const { exec } = require('child_process');
          let command;
          
          switch (process.platform) {
            case 'darwin':
              // macOS: open -R 可以在 Finder 中显示并选中文件
              command = `open -R "${filepath}"`;
              break;
            case 'win32':
              // Windows: explorer /select
              command = `explorer /select,"${filepath.replace(/\//g, '\\')}"`;
              break;
            default:
              // Linux: 使用 xdg-open 打开所在目录
              const dir = path.dirname(filepath);
              command = `xdg-open "${dir}"`;
          }
          
          exec(command, (err) => {
            if (err) {
              console.error('打开文件管理器失败:', err);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: '打开失败' }));
            } else {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, filepath }));
            }
          });
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
    
    // API: 清除指定用户的聊天记录
    if (pathname === '/api/clear-user-chat' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const { userId } = JSON.parse(body);
          if (!userId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '缺少 userId' }));
            return;
          }
          
          const clearedCount = chatStore.clearUserMessages(userId);
          console.log(`[DEBUG] 清除用户 ${userId} 的聊天记录，共 ${clearedCount} 条`);
          
          // 通知所有客户端和服务端刷新聊天记录
          broadcast({ type: 'chat_history_changed', userId });
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, clearedCount }));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }
    
    // API: 服务端发送消息给客户端
    if (pathname === '/api/server-message' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const { targetUserId, content } = JSON.parse(body);
          const time = new Date().toLocaleTimeString('zh-CN');
          
          // 创建服务端消息
          const serverMsg = chatStore.saveMessage({
            role: 'ai',  // 服务端消息显示为 AI 角色
            content,
            userId: targetUserId,
            userName: '服务端',
            userAvatar: '🖥️',
          });
          
          // 发送给目标用户
          console.log(`[DEBUG] 服务端发送消息给客户端 ${targetUserId}:`, JSON.stringify(serverMsg, null, 2));
          sendToUser(targetUserId, { type: 'new_chat_message', message: serverMsg });
          // 发送给所有服务端控制台
          console.log(`[DEBUG] 服务端发送消息给服务端控制台:`, JSON.stringify(serverMsg, null, 2));
          sendToServers({ type: 'new_chat_message', message: serverMsg });
          
          console.log(`[${time}] 🖥️ 服务端 -> ${targetUserId}: ${content.substring(0, 30)}...`);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }
    
    // API: 服务端上传文件给客户端
    if (pathname === '/api/server-upload' && req.method === 'POST') {
      const boundary = req.headers['content-type']?.split('boundary=')[1];
      if (!boundary) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '无效的请求格式' }));
        return;
      }
      
      let data = Buffer.alloc(0);
      req.on('data', chunk => {
        data = Buffer.concat([data, chunk]);
      });
      
      req.on('end', async () => {
        try {
          // 解析 multipart 数据
          const parts = parseMultipart(data, boundary);
          const targetUserId = parts.fields?.targetUserId;
          const file = parts.files?.[0];
          
          if (!file || !targetUserId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '缺少文件或目标用户' }));
            return;
          }
          
          // 保存文件
          const result = fileManager.saveFile(file.data, file.filename, file.contentType || 'application/octet-stream');
          const time = new Date().toLocaleTimeString('zh-CN');
          
          // 创建文件消息
          const fileMsg = chatStore.saveMessage({
            role: 'ai',
            content: `发送文件: ${file.filename}`,
            userId: targetUserId,
            userName: '服务端',
            userAvatar: '🖥️',
            messageType: result.category === 'images' ? 'image' : result.category === 'videos' ? 'video' : 'file',
            file: {
              filename: result.filename,
              size: file.data.length,
              category: result.category,
            },
          });
          
          // 发送给目标用户
          console.log(`[DEBUG] 服务端发送文件消息给客户端 ${targetUserId}:`, JSON.stringify(fileMsg, null, 2));
          sendToUser(targetUserId, { type: 'new_chat_message', message: fileMsg });
          // 发送给所有服务端控制台
          console.log(`[DEBUG] 服务端发送文件消息给服务端控制台:`, JSON.stringify(fileMsg, null, 2));
          sendToServers({ type: 'new_chat_message', message: fileMsg });
          
          console.log(`[${time}] 🖥️ 服务端发送文件 -> ${targetUserId}: ${file.filename}`);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
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
}

// 服务客户端页面（从 dist 或 web 目录）
async function serveClientPage(res, token, isServerLogin = false) {
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
  
  // 注入 token 和配置（转义特殊字符）
  const escapedToken = (token || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'");
  const injectedScript = `<script>
    window.AUTH_TOKEN = "${escapedToken}";
    window.IS_SERVER_VIEW = false;
    window.IS_SERVER_LOGIN = ${isServerLogin};
  </script>`;
  // 匹配真正的</head>标签（在</style>之后，</body>之前）
  html = html.replace(/(<\/style>\s*<\/head>)/, `${injectedScript}$1`);
  
  res.writeHead(200, { 
    'Content-Type': 'text/html; charset=utf-8',
    'Set-Cookie': `token=${token}; Path=/; SameSite=Strict`,
  });
  res.end(html);
}

// 403 禁止访问页面（支持中英文）
function serve403Page(res, req) {
  // 检测浏览器语言
  const acceptLang = req?.headers?.['accept-language'] || '';
  const isZh = acceptLang.toLowerCase().startsWith('zh');
  
  const i18n = isZh ? {
    title: '403 - 禁止访问',
    message: '访问被拒绝',
    description: '需要有效的授权令牌才能访问此页面',
    howTo: '如何连接？',
    step1: '在服务端电脑上启动 LAN Bridge',
    step2: '使用手机扫描终端中的二维码',
    step3: '或等待浏览器自动打开控制台',
  } : {
    title: '403 - Access Denied',
    message: 'Access Denied',
    description: 'A valid authorization token is required to access this page',
    howTo: 'How to connect?',
    step1: 'Start LAN Bridge on the server computer',
    step2: 'Scan the QR code in the terminal with your phone',
    step3: 'Or wait for the browser to open automatically',
  };
  
  const html = `<!DOCTYPE html>
<html lang="${isZh ? 'zh-CN' : 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${i18n.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); 
      min-height: 100vh; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
    }
    .container { 
      text-align: center; 
      padding: 40px; 
    }
    .icon { 
      font-size: 80px; 
      margin-bottom: 24px; 
    }
    h1 { 
      color: #e74c3c; 
      font-size: 48px; 
      margin-bottom: 16px; 
    }
    p { 
      color: #94a3b8; 
      font-size: 18px; 
      line-height: 1.6; 
      max-width: 400px; 
      margin: 0 auto 32px; 
    }
    .tip { 
      background: rgba(255,255,255,0.05); 
      border: 1px solid rgba(255,255,255,0.1); 
      border-radius: 12px; 
      padding: 20px; 
      color: #64748b; 
      font-size: 14px; 
      max-width: 400px; 
      margin: 0 auto; 
    }
    .tip strong { color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">🔒</div>
    <h1>403</h1>
    <p>${i18n.message}<br>${i18n.description}</p>
    <div class="tip">
      <strong>${i18n.howTo}</strong><br><br>
      1. ${i18n.step1}<br>
      2. ${i18n.step2}<br>
      3. ${i18n.step3}
    </div>
  </div>
</body>
</html>`;
  
  res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

// 服务端控制台页面
async function serveServerPage(res, serverToken) {
  // 优先使用打包后的文件
  let htmlPath = path.join(__dirname, 'dist', 'index.html');
  if (!fs.existsSync(htmlPath)) {
    htmlPath = path.join(__dirname, 'web', 'index.html');
  }
  
  if (fs.existsSync(htmlPath)) {
    let html = fs.readFileSync(htmlPath, 'utf8');
    
    // 注入服务端标识和 token（转义特殊字符）
    const escapedToken = serverToken.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'");
    const injectedScript = `<script>
      window.AUTH_TOKEN = "";
      window.SERVER_TOKEN = "${escapedToken}";
      window.IS_SERVER_VIEW = true;
    </script>`;
    // 匹配真正的</head>标签（在</style>之后，</body>之前）
    html = html.replace(/(<\/style>\s*<\/head>)/, `${injectedScript}$1`);
    
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
  <title>LAN Bridge - 控制台</title>
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
    <p class="subtitle">内网桥接工具 - 服务端控制台</p>
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
  const clientUrl = `http://${ip}:${port}/client`;
  const serverToken = auth.getServerToken();
  const serverUrl = `http://localhost:${port}/server?server_token=${serverToken}`;
  
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║          🌉 LAN Bridge v2 - 内网桥接工具           ║');
  console.log('║    文本同步 | 文件传输 | 用户管理 | 快捷方法       ║');
  console.log('╠═══════════════════════════════════════════════════╣');
  console.log(`║  📱 客户端: http://${ip}:${port}/client`.padEnd(52) + '║');
  console.log(`║  🖥️  服务端: http://localhost:${port}/server`.padEnd(51) + '║');
  console.log(`║  最大连接: ${String(userManager.getMaxConnections()).padEnd(38)}║`);
  console.log('╚═══════════════════════════════════════════════════╝');
  
  console.log('\n📱 手机扫码或访问客户端地址，输入密码即可连接\n');
  
  console.log(`📤 发送AI回复: node send-reply.js "内容"${port !== 9527 ? ` --port=${port}` : ''}`);
  console.log('\n按 Ctrl+C 停止服务\n');
  console.log('─'.repeat(50));
  
  // 自动打开浏览器（带服务端 token）
  console.log('\n🌐 正在打开服务端控制台...\n');
  openBrowser(serverUrl);
}

// 设置 WebSocket
function setupWebSocket(server) {
  const wss = new WebSocketServer({ server });
  
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const serverToken = url.searchParams.get('server_token');
    const isLocal = url.searchParams.get('local') === 'true';
    let deviceId = url.searchParams.get('device_id');  // 设备标识
    
    // 本地连接检查（只有 localhost 才算本地）
    const clientIP = req.socket.remoteAddress;
    const isLocalhost = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(clientIP);
    
    // 服务端连接：需要有效的 server_token 且来自 localhost
    const isValidServerConnection = isLocalhost && auth.validateServerToken(serverToken);
    
    // 客户端连接：需要有效的 client token
    const isValidClientConnection = auth.validateToken(token);
    
    // 本地工具连接（如 send-reply.js）
    const isLocalToolConnection = isLocalhost && isLocal;
    
    // 如果没有deviceId，使用IP地址+连接类型作为唯一标识
    if (!deviceId) {
      const connectionType = isValidServerConnection ? 'server' : 'client';
      deviceId = `ip_${clientIP?.replace(/:/g, '_') || 'unknown'}_${connectionType}`;
    }
    
    if (!isValidServerConnection && !isValidClientConnection && !isLocalToolConnection) {
      console.log('\n❌ WebSocket 连接被拒绝: 无效的 token\n');
      ws.close(4001, '未授权');
      return;
    }
    
    // 服务端连接不占用用户名额
    if (isValidServerConnection) {
      clients.add(ws);
      ws.isServerView = true;
      console.log('\n✅ 服务端控制台已连接\n');
      
      // 发送当前用户列表
      broadcastUserList();
      
      ws.on('message', (data) => {
        handleMessage(ws, data);
      });
      
      ws.on('close', () => {
        clients.delete(ws);
        console.log('\n📤 服务端控制台已断开\n');
      });
      
      return;
    }
    
    // 添加普通用户
    const result = userManager.addUser(ws, token, deviceId);
    if (result.error) {
      console.log(`\n❌ 连接被拒绝: ${result.error}\n`);
      ws.close(4003, result.error);
      return;
    }
    
    const user = result.user;
    clients.add(ws);
    
    console.log(`\n✅ ${user.name} ${user.avatar} 已连接! (当前: ${userManager.getOnlineCount()}/${userManager.getMaxConnections()})\n`);
    
    // 发送用户信息（排除 ws 引用避免循环引用）
    const { ws: _, ...userInfo } = user;
    ws.send(JSON.stringify({ type: 'user_info', user: userInfo }));
    
    // 发送历史聊天记录
    const messages = chatStore.getRecentMessages(50);
    ws.send(JSON.stringify({ type: 'chat_history', messages }));
    
    // 广播新用户（排除 ws 引用）
    broadcast({ type: 'user_connected', user: userInfo }, ws);
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
  // 首先处理密码设置
  await promptForPassword();
  
  auth.init();
  fileManager.init();
  chatStore.init();
  
  const ip = getLocalIP();
  const httpServer = createHttpServer();
  
  try {
    const actualPort = await tryListen(httpServer, getPreferredPort());
    PORT = actualPort;
    
    showStartupInfo(ip, actualPort);
    setupWebSocket(httpServer);
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
