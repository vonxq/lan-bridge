import { create } from 'zustand';
import type { User, ChatMessage, FileInfo, Shortcut, Settings, ConnectionStatus, UserActivity } from '../types';

interface AppState {
  // 连接状态
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;

  // 当前用户信息
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;

  // 在线用户列表
  users: User[];
  setUsers: (users: User[]) => void;
  addUser: (user: User) => void;
  removeUser: (userId: string) => void;
  updateUser: (userId: string, updates: Partial<User>) => void;

  // 当前输入文本
  currentText: string;
  setCurrentText: (text: string) => void;

  // 聊天记录
  chatMessages: ChatMessage[];
  setChatMessages: (messages: ChatMessage[]) => void;
  addChatMessage: (message: ChatMessage) => void;
  clearChatMessages: () => void;

  // 用户活动记录
  activities: UserActivity[];
  setActivities: (activities: UserActivity[]) => void;
  addActivity: (activity: UserActivity) => void;

  // 文件列表
  files: FileInfo[];
  setFiles: (files: FileInfo[]) => void;
  addFile: (file: FileInfo) => void;
  removeFile: (filename: string) => void;

  // 快捷方法
  shortcuts: Shortcut[];
  setShortcuts: (shortcuts: Shortcut[]) => void;
  addShortcut: (shortcut: Shortcut) => void;
  updateShortcut: (id: string, updates: Partial<Shortcut>) => void;
  removeShortcut: (id: string) => void;

  // 设置
  settings: Settings;
  setSettings: (settings: Partial<Settings>) => void;

  // AI 回复开关
  aiReplyEnabled: boolean;
  setAiReplyEnabled: (enabled: boolean) => void;

  // 选中的用户（用于查看历史）
  selectedUserId: string | null;
  setSelectedUserId: (userId: string | null) => void;
}

// 默认快捷方法
const defaultShortcuts: Shortcut[] = [
  {
    id: 'quick-send',
    name: '快速发送',
    type: 'action',
    actions: [
      { type: 'paste' },
      { type: 'wait', delay: 50 },
      { type: 'enter' },
    ],
    isBuiltin: true,
    order: 1,
  },
  {
    id: 'ai-chat',
    name: 'AI 对话',
    type: 'action',
    actions: [
      { type: 'paste', aiReply: true },
      { type: 'wait', delay: 50 },
      { type: 'enter' },
    ],
    isBuiltin: true,
    order: 2,
  },
  {
    id: 'prompt-translate',
    name: '翻译',
    type: 'template',
    template: '请将以下内容翻译成中文：\n\n',
    isBuiltin: true,
    order: 3,
  },
  {
    id: 'prompt-explain',
    name: '解释代码',
    type: 'template',
    template: '请解释以下代码的功能：\n\n',
    isBuiltin: true,
    order: 4,
  },
  {
    id: 'prompt-fix',
    name: '修复错误',
    type: 'template',
    template: '请帮我修复以下代码中的错误：\n\n',
    isBuiltin: true,
    order: 5,
  },
];

const defaultSettings: Settings = {
  maxConnections: 3,
  aiReplyEnabled: false,
  theme: 'auto',
};

export const useAppStore = create<AppState>((set) => ({
  // 连接状态
  connectionStatus: 'disconnected',
  setConnectionStatus: (status) => set({ connectionStatus: status }),

  // 当前用户
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),

  // 用户列表
  users: [],
  setUsers: (users) => set({ users }),
  addUser: (user) => set((state) => ({ users: [...state.users, user] })),
  removeUser: (userId) => set((state) => ({ users: state.users.filter((u) => u.id !== userId) })),
  updateUser: (userId, updates) =>
    set((state) => ({
      users: state.users.map((u) => (u.id === userId ? { ...u, ...updates } : u)),
    })),

  // 当前文本
  currentText: '',
  setCurrentText: (text) => set({ currentText: text }),

  // 聊天记录
  chatMessages: [],
  setChatMessages: (messages) => set({ chatMessages: messages }),
  addChatMessage: (message) =>
    set((state) => ({ chatMessages: [...state.chatMessages, message] })),
  clearChatMessages: () => set({ chatMessages: [] }),

  // 活动记录
  activities: [],
  setActivities: (activities) => set({ activities }),
  addActivity: (activity) =>
    set((state) => ({ activities: [...state.activities, activity].slice(-200) })),

  // 文件
  files: [],
  setFiles: (files) => set({ files }),
  addFile: (file) => set((state) => ({ files: [file, ...state.files] })),
  removeFile: (filename) =>
    set((state) => ({ files: state.files.filter((f) => f.filename !== filename) })),

  // 快捷方法
  shortcuts: defaultShortcuts,
  setShortcuts: (shortcuts) => set({ shortcuts }),
  addShortcut: (shortcut) => set((state) => ({ shortcuts: [...state.shortcuts, shortcut] })),
  updateShortcut: (id, updates) =>
    set((state) => ({
      shortcuts: state.shortcuts.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    })),
  removeShortcut: (id) =>
    set((state) => ({ shortcuts: state.shortcuts.filter((s) => s.id !== id) })),

  // 设置
  settings: defaultSettings,
  setSettings: (settings) => set((state) => ({ settings: { ...state.settings, ...settings } })),

  // AI 回复
  aiReplyEnabled: false,
  setAiReplyEnabled: (enabled) => set({ aiReplyEnabled: enabled }),

  // 选中用户
  selectedUserId: null,
  setSelectedUserId: (userId) => set({ selectedUserId: userId }),
}));
