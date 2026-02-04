/**
 * 聊天记录存储模块
 * 按日期存储聊天记录到本地文件
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// 聊天记录存储目录
const CHATS_DIR = path.join(os.homedir(), 'Documents', 'lan-bridge', 'chats');

/**
 * 初始化聊天存储目录
 */
function init() {
  if (!fs.existsSync(CHATS_DIR)) {
    fs.mkdirSync(CHATS_DIR, { recursive: true });
  }
  return CHATS_DIR;
}

/**
 * 获取当前日期字符串
 * @returns {string} YYYY-MM-DD 格式
 */
function getDateString(date = new Date()) {
  return date.toISOString().split('T')[0];
}

/**
 * 获取聊天记录文件路径
 * @param {string} dateStr 日期字符串 (YYYY-MM-DD)
 */
function getChatFilePath(dateStr) {
  return path.join(CHATS_DIR, `${dateStr}.json`);
}

/**
 * 读取指定日期的聊天记录
 * @param {string} dateStr 日期字符串 (YYYY-MM-DD)
 * @returns {Array} 消息数组
 */
function getMessages(dateStr) {
  const filePath = getChatFilePath(dateStr);
  
  if (!fs.existsSync(filePath)) {
    return [];
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('读取聊天记录失败:', error.message);
    return [];
  }
}

/**
 * 保存消息
 * @param {object} message 消息对象 { role, content, userId, userName, userAvatar }
 * @returns {object} 保存的消息（含 id 和 timestamp）
 */
function saveMessage(message) {
  init();
  
  const now = new Date();
  const dateStr = getDateString(now);
  const filePath = getChatFilePath(dateStr);
  
  // 读取现有消息
  const messages = getMessages(dateStr);
  
  // 创建新消息
  const newMessage = {
    id: `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    role: message.role, // 'user' 或 'ai'
    content: message.content,
    userId: message.userId || (message.role === 'ai' ? 'ai' : 'unknown'),
    userName: message.userName || (message.role === 'ai' ? 'AI' : '未知'),
    userAvatar: message.userAvatar || (message.role === 'ai' ? '🤖' : '👤'),
    timestamp: now.toISOString(),
    time: now.toLocaleTimeString('zh-CN'),
    // 保存消息类型和文件信息
    messageType: message.messageType || 'text',
    file: message.file || null,
  };
  
  // 添加到消息列表
  messages.push(newMessage);
  
  // 保存到文件
  try {
    fs.writeFileSync(filePath, JSON.stringify(messages, null, 2), 'utf8');
  } catch (error) {
    console.error('保存聊天记录失败:', error.message);
  }
  
  return newMessage;
}

/**
 * 获取最近的消息
 * @param {number} limit 数量限制
 * @returns {Array} 消息数组
 */
function getRecentMessages(limit = 50) {
  init();
  
  const allMessages = [];
  const dates = getAllDates();
  
  // 从最新的日期开始读取
  for (const dateStr of dates) {
    const messages = getMessages(dateStr);
    allMessages.push(...messages);
    
    if (allMessages.length >= limit) {
      break;
    }
  }
  
  // 按时间排序并限制数量
  allMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return allMessages.slice(0, limit).reverse();
}

/**
 * 获取今天的聊天记录
 * @returns {Array} 消息数组
 */
function getTodayMessages() {
  init();
  return getMessages(getDateString());
}

/**
 * 获取所有有记录的日期
 * @returns {Array<string>} 日期数组，倒序排列
 */
function getAllDates() {
  init();
  
  if (!fs.existsSync(CHATS_DIR)) {
    return [];
  }
  
  const files = fs.readdirSync(CHATS_DIR);
  const dates = files
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''))
    .sort((a, b) => b.localeCompare(a)); // 倒序
  
  return dates;
}

/**
 * 清除指定日期的聊天记录
 * @param {string} dateStr 日期字符串
 * @returns {boolean} 是否成功
 */
function clearMessages(dateStr) {
  const filePath = getChatFilePath(dateStr);
  
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  
  return false;
}

/**
 * 清除今天的聊天记录
 */
function clearTodayMessages() {
  return clearMessages(getDateString());
}

/**
 * 清除指定用户的聊天记录
 * @param {string} userId 用户ID
 * @returns {number} 清除的消息数量
 */
function clearUserMessages(userId) {
  init();
  
  const dates = getAllDates();
  let clearedCount = 0;
  
  dates.forEach(dateStr => {
    const messages = getMessages(dateStr);
    const originalLength = messages.length;
    
    // 过滤掉该用户的消息（包括该用户发送的消息和发送给该用户的消息）
    const filteredMessages = messages.filter(msg => {
      // 保留不是该用户发送的消息，且不是发送给该用户的消息
      return msg.userId !== userId && (msg.role !== 'ai' || !msg.userId || msg.userId !== userId);
    });
    
    const removedCount = originalLength - filteredMessages.length;
    if (removedCount > 0) {
      clearedCount += removedCount;
      const filePath = getChatFilePath(dateStr);
      
      if (filteredMessages.length === 0) {
        // 如果没有消息了，删除文件
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } else {
        // 保存过滤后的消息
        try {
          fs.writeFileSync(filePath, JSON.stringify(filteredMessages, null, 2), 'utf8');
        } catch (error) {
          console.error(`清除用户 ${userId} 的聊天记录失败 (${dateStr}):`, error.message);
        }
      }
    }
  });
  
  return clearedCount;
}

/**
 * 获取聊天统计信息
 */
function getStats() {
  init();
  
  const dates = getAllDates();
  let totalMessages = 0;
  let userMessages = 0;
  let aiMessages = 0;
  
  dates.forEach(dateStr => {
    const messages = getMessages(dateStr);
    totalMessages += messages.length;
    userMessages += messages.filter(m => m.role === 'user').length;
    aiMessages += messages.filter(m => m.role === 'ai').length;
  });
  
  return {
    totalDays: dates.length,
    totalMessages,
    userMessages,
    aiMessages,
    latestDate: dates[0] || null
  };
}

module.exports = {
  init,
  saveMessage,
  getMessages,
  getRecentMessages,
  getTodayMessages,
  getAllDates,
  clearMessages,
  clearTodayMessages,
  clearUserMessages,
  getStats
};
