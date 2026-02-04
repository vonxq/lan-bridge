// 用户类型
export interface User {
  id: string;
  name: string;
  avatar: string;
  token: string;
  connectedAt: string;
  lastActiveAt: string;
  isOnline: boolean;
}

// 用户活动记录
export interface UserActivity {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  type: 'message' | 'file' | 'paste' | 'replace' | 'submit' | 'clipboard' | 'ai_reply';
  content: string;
  metadata?: {
    filename?: string;
    fileSize?: number;
    fileType?: string;
    category?: string;
  };
  timestamp: string;
  time: string;
}

// 聊天消息
export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
  time: string;
  // 文件相关字段
  messageType?: 'text' | 'file' | 'image' | 'video' | 'action';
  file?: {
    filename: string;
    category: 'files' | 'images' | 'videos';
    size: number;
    mimeType?: string;
    url?: string;
    uploadTime?: string;
  };
  // 上传进度
  uploadProgress?: number;
}

// 文件信息
export interface FileInfo {
  filename: string;
  category: 'files' | 'images' | 'videos';
  size: number;
  mimeType: string;
  createdAt: string;
  modifiedAt: string;
  userId?: string;
  userName?: string;
}

// 快捷方法
export interface Shortcut {
  id: string;
  name: string;
  type: 'template' | 'action' | 'keyboard';
  template?: string;
  actions?: ShortcutAction[];
  keyboard?: {
    key: string;
    modifiers: ('ctrl' | 'cmd' | 'shift' | 'alt')[];
  };
  isBuiltin: boolean;
  order: number;
}

export interface ShortcutAction {
  type: 'paste' | 'enter' | 'wait' | 'clear' | 'clipboard';
  delay?: number;
  aiReply?: boolean;
}

// 设置
export interface Settings {
  maxConnections: number;
  aiReplyEnabled: boolean;
  theme: 'light' | 'dark' | 'auto';
}

// WebSocket 消息类型
export type WSMessageType =
  | 'sync_text'
  | 'paste_only'
  | 'submit'
  | 'replace_line'
  | 'get_clipboard'
  | 'get_current_line'
  | 'get_files'
  | 'delete_file'
  | 'get_chat_history'
  | 'clear_chat'
  | 'ai_reply'
  | 'ack'
  | 'clipboard_content'
  | 'current_line_content'
  | 'chat_history'
  | 'file_list'
  | 'user_connected'
  | 'user_disconnected'
  | 'user_list'
  | 'user_info'
  | 'user_activity'
  | 'settings_update'
  | 'kick_user'
  | 'user_kicked'
  | 'chat_cleared'
  | 'new_chat_message'
  | 'settings_changed'
  | 'error';

export interface WSMessage {
  type: WSMessageType;
  [key: string]: unknown;
}

// 连接状态
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';
