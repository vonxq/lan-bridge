/**
 * 文件管理模块
 * 管理上传的文件（图片、视频、普通文件）
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const mime = require('mime-types');

// 基础存储目录
const BASE_DIR = path.join(os.homedir(), 'Documents', 'lan-bridge');

// 子目录
const DIRS = {
  files: path.join(BASE_DIR, 'files'),
  images: path.join(BASE_DIR, 'images'),
  videos: path.join(BASE_DIR, 'videos'),
  chats: path.join(BASE_DIR, 'chats')
};

/**
 * 初始化存储目录
 */
function init() {
  // 创建所有必要的目录
  Object.values(DIRS).forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 创建目录: ${dir}`);
    }
  });
  
  return BASE_DIR;
}

/**
 * 获取基础目录
 */
function getBaseDir() {
  return BASE_DIR;
}

/**
 * 获取子目录路径
 * @param {string} type 类型: files, images, videos, chats
 */
function getDir(type) {
  return DIRS[type] || DIRS.files;
}

/**
 * 根据 MIME 类型判断文件分类
 * @param {string} mimeType MIME 类型
 * @returns {string} 分类: images, videos, files
 */
function getFileCategory(mimeType) {
  if (!mimeType) return 'files';
  
  if (mimeType.startsWith('image/')) {
    return 'images';
  } else if (mimeType.startsWith('video/')) {
    return 'videos';
  }
  return 'files';
}

/**
 * 生成唯一文件名
 * @param {string} originalName 原始文件名
 * @returns {string} 唯一文件名
 */
function generateUniqueFilename(originalName) {
  const ext = path.extname(originalName);
  const base = path.basename(originalName, ext);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${base}_${timestamp}_${random}${ext}`;
}

/**
 * 保存文件
 * @param {Buffer} buffer 文件内容
 * @param {string} originalName 原始文件名
 * @param {string} mimeType MIME 类型
 * @returns {object} 保存结果 { filename, path, category, size, mimeType }
 */
function saveFile(buffer, originalName, mimeType) {
  const category = getFileCategory(mimeType);
  const dir = DIRS[category];
  const filename = generateUniqueFilename(originalName);
  const filePath = path.join(dir, filename);
  
  fs.writeFileSync(filePath, buffer);
  
  return {
    filename,
    path: filePath,
    category,
    size: buffer.length,
    mimeType: mimeType || mime.lookup(originalName) || 'application/octet-stream',
    createdAt: new Date().toISOString()
  };
}

/**
 * 获取文件列表
 * @param {string} category 分类: files, images, videos, all
 * @returns {Array} 文件列表
 */
function getFileList(category = 'all') {
  const categories = category === 'all' 
    ? ['files', 'images', 'videos'] 
    : [category];
  
  const files = [];
  
  categories.forEach(cat => {
    const dir = DIRS[cat];
    if (!fs.existsSync(dir)) return;
    
    const items = fs.readdirSync(dir);
    items.forEach(filename => {
      const filePath = path.join(dir, filename);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile()) {
        files.push({
          filename,
          category: cat,
          size: stats.size,
          mimeType: mime.lookup(filename) || 'application/octet-stream',
          createdAt: stats.birthtime.toISOString(),
          modifiedAt: stats.mtime.toISOString()
        });
      }
    });
  });
  
  // 按创建时间倒序排列
  files.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  return files;
}

/**
 * 获取文件路径
 * @param {string} filename 文件名
 * @param {string} category 分类
 * @returns {string|null} 文件路径
 */
function getFilePath(filename, category) {
  // 如果指定了分类
  if (category && DIRS[category]) {
    const filePath = path.join(DIRS[category], filename);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  
  // 在所有目录中查找
  for (const cat of ['images', 'videos', 'files']) {
    const filePath = path.join(DIRS[cat], filename);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  
  return null;
}

/**
 * 删除文件
 * @param {string} filename 文件名
 * @param {string} category 分类（可选）
 * @returns {boolean} 是否删除成功
 */
function deleteFile(filename, category) {
  const filePath = getFilePath(filename, category);
  
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  
  return false;
}

/**
 * 读取文件
 * @param {string} filename 文件名
 * @param {string} category 分类（可选）
 * @returns {Buffer|null} 文件内容
 */
function readFile(filename, category) {
  const filePath = getFilePath(filename, category);
  
  if (filePath && fs.existsSync(filePath)) {
    return fs.readFileSync(filePath);
  }
  
  return null;
}

/**
 * 获取存储统计信息
 */
function getStats() {
  const stats = {
    baseDir: BASE_DIR,
    categories: {}
  };
  
  ['files', 'images', 'videos', 'chats'].forEach(cat => {
    const dir = DIRS[cat];
    if (!fs.existsSync(dir)) {
      stats.categories[cat] = { count: 0, size: 0 };
      return;
    }
    
    const items = fs.readdirSync(dir);
    let totalSize = 0;
    let count = 0;
    
    items.forEach(filename => {
      const filePath = path.join(dir, filename);
      const fileStats = fs.statSync(filePath);
      if (fileStats.isFile()) {
        count++;
        totalSize += fileStats.size;
      }
    });
    
    stats.categories[cat] = { count, size: totalSize };
  });
  
  return stats;
}

module.exports = {
  init,
  getBaseDir,
  getDir,
  getFileCategory,
  saveFile,
  getFileList,
  getFilePath,
  deleteFile,
  readFile,
  getStats
};
