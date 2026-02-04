# 🌉 LAN Bridge

A powerful LAN bridging tool built with React + Vite. Enables text synchronization, file transfer, clipboard operations, and more between your phone and computer.

[中文文档](#中文文档)

## Features

- 📝 **Text Sync** - Type on your phone, receive on your computer in real-time
- 📋 **Clipboard Operations** - Read/write computer clipboard, simulate paste & enter
- 📁 **File Transfer** - Upload/download images, videos, and documents
- 💬 **Chat History** - Auto-save chat history, filter by user
- 👥 **User Management** - Connection limits, random usernames & avatars
- ⚡ **Shortcuts** - Text templates, action combinations, custom shortcuts
- 🔐 **Secure Connection** - Encrypted token protection
- 📱 **QR Code** - Scan encrypted QR code to connect
- 🌐 **Multi-language** - English & Chinese, auto-detect browser language

## Quick Start

### Option 1: npx (Recommended)

```bash
npx lan-bridge
```

### Option 2: Global Install

```bash
npm install -g lan-bridge
lan-bridge
```

### Option 3: Local Development

```bash
git clone https://github.com/vonxq/lan-bridge.git
cd lan-bridge
npm install
npm run build   # Build frontend
npm start       # Start server
```

## Usage

1. Start the server - a QR code will appear in the terminal
2. The browser will automatically open the server console at `http://localhost:9527`
3. Scan the QR code with your phone browser
4. Start using the features

**Note:** Without a valid token, accessing the server directly will show a 403 Forbidden page.

## CLI Options

```bash
# Specify port
lan-bridge --port=8080
lan-bridge -p 8080

# Use environment variable
PORT=8080 lan-bridge
```

## Features Guide

### Text Operations

- **Paste** - Paste text to the currently focused app on your computer
- **Replace** - Replace current line (useful for terminals)
- **Send** - Paste text and press Enter

### Shortcuts

- **Text Templates** - Preset prompts (translate, explain code, etc.)
- **Action Combinations** - Custom action sequences (paste + wait + enter)
- **Custom** - Add your own shortcuts

### User Management

- Default max 3 connections, configurable in settings
- Each user gets a random name and emoji avatar
- View all connected users, kick specific users
- Filter chat history by user

### File Transfer

- Drag & drop or click to upload
- Auto-categorize by type (images/videos/files)
- Preview images and videos online
- Files saved to `~/Documents/lan-bridge/`

### Language Settings

- Supports English and Chinese
- Auto-detects browser language on first use
- Can be changed in Settings

## Data Storage

All data is saved in the user's Documents directory:

```
~/Documents/lan-bridge/
├── files/      # General files
├── images/     # Image files
├── videos/     # Video files
├── chats/      # Chat history (by date)
└── settings.json
```

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Zustand
- **Backend**: Node.js + WebSocket
- **Build**: vite-plugin-singlefile (single HTML output)

## Development

```bash
# Frontend dev mode
npm run dev:web

# Backend dev mode
npm run dev

# Build frontend
npm run build

# Production server
npm start
```

## Security

- New encrypted token generated on each server start
- All connections require valid token
- Token encrypted with AES-256-GCM
- Server and client use separate tokens
- Direct access without token returns 403 Forbidden

## Requirements

- Node.js >= 14.0.0
- macOS / Windows / Linux

## Dependencies

- `ws` - WebSocket server
- `qrcode` - QR code generation
- `qrcode-terminal` - Terminal QR code display
- `mime-types` - MIME type detection
- `react` - Frontend framework
- `zustand` - State management
- `vite` - Build tool

## License

MIT

---

# 中文文档

一个功能强大的内网桥接工具，基于 React + Vite 组件化架构，支持手机与电脑之间的文本同步、文件传输、剪贴板操作、用户管理、快捷方法等功能。

## 特性

- 📝 **文本同步** - 手机输入文字，电脑实时接收
- 📋 **剪贴板操作** - 读取/写入电脑剪贴板，模拟粘贴、回车等操作
- 📁 **文件传输** - 支持图片、视频、文档等文件上传下载
- 💬 **聊天记录** - 自动保存聊天记录到本地，支持按用户筛选
- 👥 **用户管理** - 限制连接数，随机用户名和头像，查看连接列表
- ⚡ **快捷方法** - 文本模板、操作组合、自定义快捷方式
- 🔐 **安全连接** - 加密 Token 保护，防止内网攻击
- 📱 **扫码连接** - 生成加密二维码，手机扫码即可连接
- 🌐 **多语言** - 支持中英文，自动检测浏览器语言

## 快速开始

### 方式一：npx 运行（推荐）

```bash
npx lan-bridge
```

### 方式二：全局安装

```bash
npm install -g lan-bridge
lan-bridge
```

### 方式三：本地开发

```bash
git clone https://github.com/vonxq/lan-bridge.git
cd lan-bridge
npm install
npm run build   # 构建前端
npm start       # 启动服务器
```

## 使用说明

1. 启动服务后，终端会显示加密二维码
2. 浏览器会自动打开服务端控制台 `http://localhost:9527`
3. 用手机浏览器扫描二维码连接
4. 开始使用各项功能

**注意：** 没有有效 token 直接访问服务器会显示 403 禁止访问页面。

## 命令行参数

```bash
# 指定端口
lan-bridge --port=8080
lan-bridge -p 8080

# 使用环境变量
PORT=8080 lan-bridge
```

## 功能说明

### 文本操作

- **粘贴** - 将输入的文本粘贴到电脑当前焦点应用
- **替换** - 替换当前行内容（适用于终端）
- **发送** - 粘贴文本并按回车发送

### 快捷方法

- **文本模板** - 预设常用 prompt（翻译、解释代码等）
- **操作组合** - 自定义操作序列（粘贴+等待+回车）
- **自定义** - 添加自己的快捷方法

### 用户管理

- 默认最大 3 个连接，可在设置中修改
- 每个用户自动分配随机名字和 emoji 头像
- 可查看所有连接用户，踢出指定用户
- 支持按用户筛选聊天记录

### 文件传输

- 支持拖拽或点击上传
- 自动按类型分类（图片/视频/文件）
- 支持在线预览图片和视频
- 文件保存在 `~/Documents/lan-bridge/` 目录

### 语言设置

- 支持中文和英文
- 首次使用自动检测浏览器语言
- 可在设置中切换语言

### AI 回复

开启 "AI 回复" 开关后，发送的内容会自动添加提示词，要求 AI 完成后发送回复到手机。

发送 AI 回复到手机：

```bash
node send-reply.js "回复内容"
```

## 数据存储

所有数据保存在用户 Documents 目录下：

```
~/Documents/lan-bridge/
├── files/      # 普通文件
├── images/     # 图片文件
├── videos/     # 视频文件
├── chats/      # 聊天记录（按日期存储）
└── settings.json # 设置
```

## 技术架构

- **前端**: React 18 + TypeScript + Vite + Zustand
- **后端**: Node.js + WebSocket
- **打包**: vite-plugin-singlefile（输出单个 HTML 文件）

## 开发命令

```bash
# 开发模式 - 前端
npm run dev:web

# 开发模式 - 后端
npm run dev

# 构建前端
npm run build

# 启动生产服务器
npm start
```

## 安全说明

- 每次启动服务器都会生成新的加密 Token
- 所有连接必须携带有效 Token
- Token 使用 AES-256-GCM 加密
- 服务端和客户端使用独立的 Token
- 没有 Token 直接访问返回 403 禁止访问
- 仅限同一内网环境使用

## 系统要求

- Node.js >= 14.0.0
- macOS / Windows / Linux

## 依赖

- `ws` - WebSocket 服务器
- `qrcode` - 二维码生成
- `qrcode-terminal` - 终端二维码显示
- `mime-types` - MIME 类型识别
- `react` - 前端框架
- `zustand` - 状态管理
- `vite` - 构建工具

## License

MIT
