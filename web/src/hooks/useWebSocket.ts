import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../stores/appStore';
import { showToast } from '../components/common/Toast';
import type { WSMessage, ChatMessage, User, FileInfo, UserActivity } from '../types';

interface UseWebSocketOptions {
  token: string;
  onMessage?: (message: WSMessage) => void;
  onTokenInvalid?: () => void;
}

export function useWebSocket({ token, onMessage, onTokenInvalid }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number>();

  const {
    setConnectionStatus,
    setCurrentUser,
    setUsers,
    addUser,
    removeUser,
    setChatMessages,
    addChatMessage,
    setFiles,
    addActivity,
    setCurrentText,
    currentText,
  } = useAppStore();

  // 获取或生成设备 ID
  const getDeviceId = useCallback(() => {
    const DEVICE_ID_KEY = 'lan-bridge-device-id';
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      // 基于浏览器特征生成设备 ID
      const ua = navigator.userAgent;
      const screen = `${window.screen.width}x${window.screen.height}`;
      const lang = navigator.language;
      const platform = navigator.platform;
      const raw = `${ua}|${screen}|${lang}|${platform}|${Date.now()}`;
      // 简单哈希
      let hash = 0;
      for (let i = 0; i < raw.length; i++) {
        const char = raw.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      deviceId = Math.abs(hash).toString(36);
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const deviceId = getDeviceId();
    const wsUrl = `${protocol}//${window.location.host}?token=${token}&device_id=${deviceId}`;

    setConnectionStatus('connecting');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      showToast('连接成功', 'success');
    };

    ws.onclose = (e) => {
      setConnectionStatus('disconnected');
      // 4001 是未授权关闭码，token 无效
      if (e.code === 4001) {
        onTokenInvalid?.();
        return;
      }
      // 3秒后自动重连
      reconnectTimeoutRef.current = window.setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      setConnectionStatus('error');
      showToast('连接失败', 'error');
    };

    ws.onmessage = (event) => {
      try {
        const data: WSMessage = JSON.parse(event.data);
        handleMessage(data);
        onMessage?.(data);
      } catch (e) {
        console.error('解析消息失败:', e);
      }
    };
  }, [token, onMessage, onTokenInvalid, setConnectionStatus]);

  const handleMessage = useCallback((data: WSMessage) => {
    switch (data.type) {
      case 'ack':
        if (data.action === 'submit') {
          setCurrentText('');
        }
        break;

      case 'clipboard_content':
        setCurrentText((data.content as string) || '');
        showToast('已获取剪贴板', 'success');
        break;

      case 'current_line_content':
        setCurrentText((data.content as string) || '');
        showToast('已获取当前行', 'success');
        break;

      case 'ai_reply':
        const aiMessage: ChatMessage = {
          id: Date.now().toString(),
          userId: 'ai',
          userName: 'AI',
          userAvatar: '🤖',
          role: 'ai',
          content: (data.summary || data.content) as string,
          timestamp: new Date().toISOString(),
          time: new Date().toLocaleTimeString('zh-CN'),
        };
        addChatMessage(aiMessage);
        showToast('收到 AI 回复', 'info');
        break;

      case 'chat_history':
        setChatMessages((data.messages as ChatMessage[]) || []);
        break;

      case 'new_chat_message':
        // 接收服务端发送的消息
        console.log('[DEBUG] 客户端收到 new_chat_message:', {
          type: data.type,
          hasMessage: !!data.message,
          message: data.message ? {
            id: (data.message as ChatMessage).id,
            role: (data.message as ChatMessage).role,
            messageType: (data.message as ChatMessage).messageType || 'text',
            hasFile: !!(data.message as ChatMessage).file,
            content: (data.message as ChatMessage).content?.substring(0, 50),
          } : null,
        });
        if (data.message) {
          const msg = data.message as ChatMessage;
          console.log('[DEBUG] 客户端添加消息详情:', JSON.stringify(msg, null, 2));
          // 确保消息有必要的字段
          const fullMsg: ChatMessage = {
            ...msg,
            userId: msg.userId || (msg.role === 'ai' ? 'ai' : 'unknown'),
            userName: msg.userName || (msg.role === 'ai' ? 'AI' : '未知'),
            userAvatar: msg.userAvatar || (msg.role === 'ai' ? '🤖' : '👤'),
            timestamp: msg.timestamp || new Date().toISOString(),
            time: msg.time || new Date().toLocaleTimeString('zh-CN'),
          };
          addChatMessage(fullMsg);
          showToast('收到新消息', 'info');
        } else {
          console.warn('[DEBUG] 客户端收到 new_chat_message 但没有 message 字段');
        }
        break;

      case 'file_list':
        setFiles((data.files as FileInfo[]) || []);
        break;

      case 'user_connected':
        const newUser = data.user as User;
        addUser(newUser);
        showToast(`${newUser.name} 已连接`, 'info');
        break;

      case 'user_disconnected':
        const userId = data.userId as string;
        removeUser(userId);
        break;

      case 'user_list':
        setUsers((data.users as User[]) || []);
        break;

      case 'user_info':
        setCurrentUser(data.user as User);
        break;

      case 'user_activity':
        addActivity(data.activity as UserActivity);
        break;

      case 'error':
        showToast((data.message as string) || '操作失败', 'error');
        break;
    }
  }, [setCurrentText, addChatMessage, setChatMessages, setFiles, addUser, removeUser, setUsers, setCurrentUser, addActivity]);

  const send = useCallback((message: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const syncText = useCallback((text: string) => {
    send({ type: 'sync_text', content: text, timestamp: Date.now() });
  }, [send]);

  const paste = useCallback((aiReply: boolean = false) => {
    send({ type: 'paste_only', needAiReply: aiReply, timestamp: Date.now() });
  }, [send]);

  const submit = useCallback((aiReply: boolean = false) => {
    if (!currentText.trim()) {
      showToast('请输入内容', 'warning');
      return;
    }
    // 添加用户消息到聊天记录
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      userId: useAppStore.getState().currentUser?.id || 'unknown',
      userName: useAppStore.getState().currentUser?.name || '我',
      userAvatar: useAppStore.getState().currentUser?.avatar || '👤',
      role: 'user',
      content: currentText,
      timestamp: new Date().toISOString(),
      time: new Date().toLocaleTimeString('zh-CN'),
    };
    addChatMessage(userMessage);
    send({ type: 'submit', needAiReply: aiReply, timestamp: Date.now() });
  }, [send, currentText, addChatMessage]);

  const replaceLine = useCallback(() => {
    send({ type: 'replace_line', timestamp: Date.now() });
  }, [send]);

  const getClipboard = useCallback(() => {
    send({ type: 'get_clipboard', timestamp: Date.now() });
  }, [send]);

  const getCurrentLine = useCallback(() => {
    send({ type: 'get_current_line', timestamp: Date.now() });
  }, [send]);

  const getFiles = useCallback((category: string = 'all') => {
    send({ type: 'get_files', category, timestamp: Date.now() });
  }, [send]);

  const deleteFile = useCallback((filename: string, category: string) => {
    send({ type: 'delete_file', filename, category, timestamp: Date.now() });
  }, [send]);

  const clearChat = useCallback(() => {
    send({ type: 'clear_chat', timestamp: Date.now() });
    useAppStore.getState().clearChatMessages();
  }, [send]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    wsRef.current?.close();
  }, []);

  useEffect(() => {
    if (token) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [token, connect, disconnect]);

  return {
    send,
    syncText,
    paste,
    submit,
    replaceLine,
    getClipboard,
    getCurrentLine,
    getFiles,
    deleteFile,
    clearChat,
    connect,
    disconnect,
  };
}
