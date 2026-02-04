export default {
  // 通用
  common: {
    loading: '加载中...',
    confirm: '确认',
    cancel: '取消',
    save: '保存',
    delete: '删除',
    refresh: '刷新',
    close: '关闭',
    download: '下载',
    upload: '上传',
    copy: '复制',
    copied: '已复制',
    clear: '清空',
    send: '发送',
    reconnect: '重连',
    settings: '设置',
    online: '在线',
    offline: '离线',
    connected: '已连接',
    connecting: '连接中...',
    disconnected: '未连接',
    connectionError: '连接错误',
    more: '更多',
    back: '返回',
  },

  // 应用标题
  app: {
    title: 'LAN Bridge',
    subtitle: '内网桥接工具',
    serverConsole: '服务端控制台',
  },

  // 403 页面
  forbidden: {
    title: '403',
    message: '访问被拒绝',
    description: '需要有效的授权令牌才能访问此页面',
    howToConnect: '如何连接？',
    step1: '在服务端电脑上启动 LAN Bridge',
    step2: '使用手机扫描终端中的二维码',
    step3: '或等待浏览器自动打开控制台',
  },

  // 状态栏
  statusBar: {
    aiReply: 'AI回复',
    usersOnline: '{count} 在线',
    serviceRunning: '服务运行中',
    connected: '已连接',
    disconnected: '未连接',
  },

  // Tab 标签
  tabs: {
    text: '文本',
    shortcuts: '快捷',
    files: '文件',
    chat: '记录',
    connections: '连接',
    qrcode: '二维码',
  },

  // 文本面板
  textPanel: {
    placeholder: '在这里输入内容...',
    charCount: '{count} 字',
    paste: '粘贴',
    replace: '替换',
    submit: '发送',
    clipboard: '剪贴板',
    currentLine: '当前行',
    clear: '清空',
    reconnect: '重连',
  },

  // 文件面板
  filePanel: {
    title: '文件管理',
    uploadFile: '上传文件',
    uploadImage: '上传图片',
    uploadVideo: '上传视频',
    allFiles: '全部',
    images: '图片',
    videos: '视频',
    documents: '文件',
    noFiles: '暂无文件',
    deleteConfirm: '确定删除此文件？',
    openInFinder: '定位',
  },

  // 聊天面板
  chatPanel: {
    title: '聊天记录',
    noMessages: '暂无聊天记录',
    clearConfirm: '确定清空聊天记录？',
    allUsers: '全部',
  },

  // 连接列表
  connectionList: {
    title: '连接管理',
    noConnections: '暂无连接',
    kickUser: '踢出',
    kickConfirm: '确定踢出该用户？',
    viewHistory: '查看记录',
    connectedAt: '连接时间',
  },

  // 二维码面板
  qrCodePanel: {
    title: '扫码连接',
    scanToConnect: '使用手机浏览器扫描二维码连接',
    sameNetwork: '请确保手机和电脑在同一网络',
    refreshQRCode: '刷新二维码',
    connections: '{current} / {max} 连接',
  },

  // 快捷方法
  shortcuts: {
    title: '快捷方法',
    noShortcuts: '暂无快捷方法',
    pasteAndEnter: '粘贴并回车',
    pasteOnly: '仅粘贴',
    replaceAndEnter: '替换并回车',
  },

  // 设置
  settings: {
    title: '设置',
    maxConnections: '最大连接数',
    language: '语言',
    theme: '主题',
    themeLight: '浅色',
    themeDark: '深色',
    themeAuto: '跟随系统',
    saveSuccess: '设置已保存',
  },

  // 消息提示
  toast: {
    uploadSuccess: '上传成功',
    uploadFailed: '上传失败',
    deleteSuccess: '删除成功',
    deleteFailed: '删除失败',
    copySuccess: '复制成功',
    operationFailed: '操作失败',
    connectionLost: '连接已断开',
    reconnecting: '正在重连...',
  },
};
