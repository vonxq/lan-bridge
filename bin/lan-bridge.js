#!/usr/bin/env node
/**
 * LAN Bridge CLI 入口
 * 
 * 用法：
 *   npx lan-bridge [--port=端口号]
 *   lan-bridge [--port=端口号]
 */

const path = require('path');

// 切换到项目根目录（确保模块路径正确）
process.chdir(path.join(__dirname, '..'));

// 启动服务器
require('../server.js');
