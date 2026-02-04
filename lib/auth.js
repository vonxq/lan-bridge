/**
 * Token 认证模块
 * 用于生成和验证加密 token，保护内网连接安全
 */

const crypto = require('crypto');

// 加密密钥（每次启动随机生成）
let SECRET_KEY = null;
let SESSION_TOKEN = null;

/**
 * 初始化认证模块（每次服务器启动调用）
 */
function init() {
  // 生成 32 字节随机密钥
  SECRET_KEY = crypto.randomBytes(32);
  // 生成 16 字节 session token
  SESSION_TOKEN = crypto.randomBytes(16).toString('hex');
  return SESSION_TOKEN;
}

/**
 * 获取当前 session token
 */
function getSessionToken() {
  return SESSION_TOKEN;
}

/**
 * 加密 token（包含时间戳，用于二维码）
 * @returns {string} 加密后的 token（hex 格式）
 */
function encryptToken() {
  if (!SECRET_KEY || !SESSION_TOKEN) {
    throw new Error('认证模块未初始化');
  }
  
  // 创建包含 token 和时间戳的数据
  const data = JSON.stringify({
    token: SESSION_TOKEN,
    timestamp: Date.now()
  });
  
  // AES-256-GCM 加密
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', SECRET_KEY, iv);
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  
  // 返回格式: iv(24) + authTag(32) + encrypted
  return iv.toString('hex') + authTag.toString('hex') + encrypted;
}

/**
 * 解密并验证 token
 * @param {string} encryptedToken 加密的 token
 * @returns {boolean} 是否有效
 */
function validateToken(encryptedToken) {
  if (!SECRET_KEY || !SESSION_TOKEN) {
    return false;
  }
  
  if (!encryptedToken || typeof encryptedToken !== 'string') {
    return false;
  }
  
  try {
    // 解析加密数据
    const iv = Buffer.from(encryptedToken.slice(0, 24), 'hex');
    const authTag = Buffer.from(encryptedToken.slice(24, 56), 'hex');
    const encrypted = encryptedToken.slice(56);
    
    // 解密
    const decipher = crypto.createDecipheriv('aes-256-gcm', SECRET_KEY, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    const data = JSON.parse(decrypted);
    
    // 验证 token
    if (data.token !== SESSION_TOKEN) {
      return false;
    }
    
    // 可选：验证时间戳（24小时内有效）
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    if (Date.now() - data.timestamp > maxAge) {
      console.log('Token 已过期');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Token 验证失败:', error.message);
    return false;
  }
}

/**
 * 从 URL 中提取并验证 token
 * @param {string} url URL 字符串
 * @returns {boolean} 是否有效
 */
function validateFromUrl(url) {
  try {
    const urlObj = new URL(url, 'http://localhost');
    const token = urlObj.searchParams.get('token');
    return validateToken(token);
  } catch (error) {
    return false;
  }
}

/**
 * 验证 HTTP 请求
 * @param {object} req HTTP 请求对象
 * @returns {boolean} 是否有效
 */
function validateRequest(req) {
  // 从 URL 查询参数获取 token
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  
  if (token) {
    return validateToken(token);
  }
  
  // 从 Cookie 获取 token
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.token) {
    return validateToken(cookies.token);
  }
  
  return false;
}

/**
 * 解析 Cookie 字符串
 */
function parseCookies(cookieStr) {
  const cookies = {};
  if (!cookieStr) return cookies;
  
  cookieStr.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
  });
  
  return cookies;
}

/**
 * 生成带 token 的 URL
 * @param {string} baseUrl 基础 URL
 * @returns {string} 带加密 token 的 URL
 */
function generateSecureUrl(baseUrl) {
  const token = encryptToken();
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}token=${token}`;
}

module.exports = {
  init,
  getSessionToken,
  encryptToken,
  validateToken,
  validateFromUrl,
  validateRequest,
  generateSecureUrl
};
