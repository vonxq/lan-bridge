/**
 * 用户管理模块
 * 管理连接的用户、生成随机身份、限制连接数
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// 设置存储路径
const SETTINGS_PATH = path.join(os.homedir(), 'Documents', 'lan-bridge', 'settings.json');

// 随机名字生成器
const adjectives = [
  '开心的', '机灵的', '勤奋的', '可爱的', '聪明的',
  '活泼的', '调皮的', '温柔的', '勇敢的', '安静的',
  '快乐的', '阳光的', '神秘的', '酷酷的', '萌萌的',
];

const nouns = [
  '小猫', '小狗', '熊猫', '兔子', '松鼠',
  '狐狸', '考拉', '老虎', '狮子', '企鹅',
  '海豚', '猴子', '小鹿', '小熊', '小象',
];

// 头像 emoji 池
const avatars = [
  '🐱', '🐶', '🐼', '🐰', '🦊',
  '🐨', '🐯', '🦁', '🐧', '🐬',
  '🐵', '🦌', '🐻', '🐘', '🦄',
  '🐸', '🐙', '🦋', '🐝', '🐢',
];

class UserManager {
  constructor() {
    this.users = new Map();        // userId -> User
    this.connections = new Map();   // ws -> userId
    this.activities = [];           // 活动记录
    this.maxConnections = 3;        // 默认最大连接数
    
    this.loadSettings();
  }

  /**
   * 加载设置
   */
  loadSettings() {
    try {
      if (fs.existsSync(SETTINGS_PATH)) {
        const data = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
        this.maxConnections = data.maxConnections || 3;
      }
    } catch (error) {
      console.error('加载设置失败:', error.message);
    }
  }

  /**
   * 保存设置
   */
  saveSettings() {
    try {
      const dir = path.dirname(SETTINGS_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(SETTINGS_PATH, JSON.stringify({
        maxConnections: this.maxConnections,
      }, null, 2));
    } catch (error) {
      console.error('保存设置失败:', error.message);
    }
  }

  /**
   * 设置最大连接数
   */
  setMaxConnections(max) {
    this.maxConnections = Math.max(1, Math.min(10, max));
    this.saveSettings();
    return this.maxConnections;
  }

  /**
   * 获取最大连接数
   */
  getMaxConnections() {
    return this.maxConnections;
  }

  /**
   * 检查是否可以接受新连接
   */
  canAcceptConnection() {
    return this.getOnlineCount() < this.maxConnections;
  }

  /**
   * 获取在线用户数
   */
  getOnlineCount() {
    return Array.from(this.users.values()).filter(u => u.isOnline).length;
  }

  /**
   * 生成随机用户身份
   */
  generateIdentity() {
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const avatar = avatars[Math.floor(Math.random() * avatars.length)];
    
    return {
      name: `${adjective}${noun}`,
      avatar,
    };
  }

  /**
   * 生成唯一用户 ID
   */
  generateUserId() {
    return `user_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * 根据设备 ID 生成固定用户名
   */
  generateIdentityFromDeviceId(deviceId) {
    if (!deviceId) return this.generateIdentity();
    
    // 使用 deviceId 的哈希值来确定性地选择名字和头像
    let hash = 0;
    for (let i = 0; i < deviceId.length; i++) {
      const char = deviceId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    hash = Math.abs(hash);
    
    const adjective = adjectives[hash % adjectives.length];
    const noun = nouns[(hash >> 4) % nouns.length];
    const avatar = avatars[(hash >> 8) % avatars.length];
    
    return {
      name: `${adjective}${noun}`,
      avatar,
    };
  }

  /**
   * 添加新用户（连接时调用）
   */
  addUser(ws, token, deviceId = null) {
    if (!this.canAcceptConnection()) {
      return { error: '连接数已达上限', code: 'MAX_CONNECTIONS' };
    }

    // 如果有 deviceId，使用固定的用户 ID
    const userId = deviceId ? `device_${deviceId}` : this.generateUserId();
    
    // 检查是否已有相同设备的用户
    const existingUser = deviceId ? this.users.get(userId) : null;
    
    const identity = deviceId ? this.generateIdentityFromDeviceId(deviceId) : this.generateIdentity();
    const now = new Date().toISOString();

    const user = {
      id: userId,
      name: existingUser?.name || identity.name,
      avatar: existingUser?.avatar || identity.avatar,
      token,
      deviceId,
      ws,  // 保存 WebSocket 引用用于定向发送
      connectedAt: existingUser?.connectedAt || now,
      lastActiveAt: now,
      isOnline: true,
    };

    this.users.set(userId, user);
    this.connections.set(ws, userId);

    // 记录活动
    this.addActivity(userId, 'connect', `${user.name} 已连接`);

    return { user };
  }

  /**
   * 移除用户（断开连接时调用）
   */
  removeUser(ws) {
    const userId = this.connections.get(ws);
    if (!userId) return null;

    const user = this.users.get(userId);
    if (user) {
      user.isOnline = false;
      user.lastActiveAt = new Date().toISOString();
      
      // 记录活动
      this.addActivity(userId, 'disconnect', `${user.name} 已断开`);
    }

    this.connections.delete(ws);
    return user;
  }

  /**
   * 获取用户（别名 getUserById）
   */
  getUser(userId) {
    return this.users.get(userId);
  }

  /**
   * 通过 ID 获取用户
   */
  getUserById(userId) {
    return this.users.get(userId);
  }

  /**
   * 通过 WebSocket 获取用户
   */
  getUserByWs(ws) {
    const userId = this.connections.get(ws);
    return userId ? this.users.get(userId) : null;
  }

  /**
   * 更新用户活跃时间
   */
  updateActivity(ws) {
    const userId = this.connections.get(ws);
    if (userId) {
      const user = this.users.get(userId);
      if (user) {
        user.lastActiveAt = new Date().toISOString();
      }
    }
  }

  /**
   * 获取所有在线用户
   */
  getOnlineUsers() {
    return Array.from(this.users.values()).filter(u => u.isOnline);
  }

  /**
   * 获取所有用户
   */
  getAllUsers() {
    return Array.from(this.users.values());
  }

  /**
   * 踢出用户
   */
  kickUser(userId) {
    const user = this.users.get(userId);
    if (!user) return null;

    // 找到对应的 WebSocket 连接
    for (const [ws, uid] of this.connections.entries()) {
      if (uid === userId) {
        ws.close(4002, '被管理员踢出');
        this.connections.delete(ws);
        break;
      }
    }

    user.isOnline = false;
    this.addActivity(userId, 'kick', `${user.name} 被踢出`);
    
    return user;
  }

  /**
   * 添加活动记录
   */
  addActivity(userId, type, content, metadata = {}) {
    const user = this.users.get(userId);
    if (!user) return;

    const activity = {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      userName: user.name,
      userAvatar: user.avatar,
      type,
      content,
      metadata,
      timestamp: new Date().toISOString(),
      time: new Date().toLocaleTimeString('zh-CN'),
    };

    this.activities.push(activity);
    
    // 只保留最近 500 条
    if (this.activities.length > 500) {
      this.activities = this.activities.slice(-500);
    }

    return activity;
  }

  /**
   * 获取用户活动记录
   */
  getUserActivities(userId, limit = 50) {
    return this.activities
      .filter(a => a.userId === userId)
      .slice(-limit);
  }

  /**
   * 获取所有活动记录
   */
  getAllActivities(limit = 100) {
    return this.activities.slice(-limit);
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      totalUsers: this.users.size,
      onlineUsers: this.getOnlineCount(),
      maxConnections: this.maxConnections,
      totalActivities: this.activities.length,
    };
  }
}

// 单例导出
module.exports = new UserManager();
