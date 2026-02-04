import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ToastContainer } from '../components/common';
import { showToast } from '../components/common/Toast';
import { useTranslation } from '../i18n/I18nContext';
import { useAppStore } from '../stores/appStore';
import type { User, ChatMessage } from '../types';

interface QRCodeData {
  qrcode: string;
  url: string;
  connections: number;
  maxConnections: number;
  users: User[];
}

export function ServerPage() {
  const [qrData, setQrData] = useState<QRCodeData | null>(null);
  const [showQR, setShowQR] = useState(false);  // 默认收起
  const [users, setUsers] = useState<User[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'users'>('chat');
  const { chatMessages, setChatMessages, addChatMessage } = useAppStore();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [serverMessage, setServerMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 按用户分组消息
  const messagesByUser = useMemo(() => {
    const groups: Record<string, { user: { id: string; name: string; avatar: string }; messages: ChatMessage[]; lastMessageTime: string }> = {};
    
    chatMessages.forEach((msg) => {
      // 只分组用户消息，AI 回复归类到对应用户
      const userId = msg.userId || 'server';
      const userName = msg.userName || '服务端';
      const userAvatar = msg.userAvatar || '🖥️';
      
      if (!groups[userId]) {
        groups[userId] = {
          user: { id: userId, name: userName, avatar: userAvatar },
          messages: [],
          lastMessageTime: msg.timestamp || '',
        };
      }
      groups[userId].messages.push(msg);
      // 更新最后消息时间
      if (msg.timestamp && msg.timestamp > groups[userId].lastMessageTime) {
        groups[userId].lastMessageTime = msg.timestamp;
      }
    });
    
    return groups;
  }, [chatMessages]);

  // 获取用户列表（有消息的用户，按最近更新排序）
  const chatUsers = useMemo(() => {
    return Object.values(messagesByUser)
      .filter(g => g.user.id !== 'server')
      .sort((a, b) => b.lastMessageTime.localeCompare(a.lastMessageTime))
      .map(g => g.user);
  }, [messagesByUser]);

  // 自动选中最新用户
  useEffect(() => {
    if (chatUsers.length > 0 && !selectedUserId) {
      setSelectedUserId(chatUsers[0].id);
    }
  }, [chatUsers, selectedUserId]);

  // 当前选中用户的消息
  const currentMessages = useMemo(() => {
    if (!selectedUserId) return [];
    return messagesByUser[selectedUserId]?.messages || [];
  }, [selectedUserId, messagesByUser]);
  const t = useTranslation();

  // 获取二维码数据
  const fetchQRCode = useCallback(async () => {
    try {
      const res = await fetch('/api/qrcode');
      if (!res.ok) throw new Error('获取二维码失败');
      const data = await res.json();
      setQrData(data);
      setUsers(data.users || []);
    } catch (e) {
      console.error('获取二维码失败:', e);
    }
  }, []);


  // 获取聊天记录
  const fetchChats = useCallback(async () => {
    try {
      const res = await fetch('/api/chats?limit=100');
      if (res.ok) {
        const data = await res.json();
        setChatMessages(data.messages || []);
      }
    } catch (e) {
      console.error('获取聊天记录失败:', e);
    }
  }, [setChatMessages]);

  // WebSocket 连接
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const serverToken =
      (window as { SERVER_TOKEN?: string }).SERVER_TOKEN ||
      new URLSearchParams(window.location.search).get('server_token') ||
      '';
    const wsUrl = `${protocol}//${window.location.host}?server_token=${serverToken}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setWsConnected(true);
      console.log('服务端 WebSocket 已连接');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWSMessage(data);
      } catch (e) {
        console.error('解析消息失败:', e);
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    };

    return () => ws.close();
  }, []);

  const handleWSMessage = (data: { type: string; [key: string]: unknown }) => {
    switch (data.type) {
      case 'user_list':
        setUsers((data.users as User[]) || []);
        break;
      case 'user_connected':
        setUsers((prev) => [...prev, data.user as User]);
        showToast(`${(data.user as User).name} 已连接`, 'info');
        break;
      case 'user_disconnected':
        setUsers((prev) => prev.filter((u) => u.id !== data.userId));
        break;
      case 'chat_history':
        fetchChats();
        break;
      case 'new_chat_message':
        // 实时添加新消息
        console.log('[DEBUG] 服务端收到 new_chat_message:', data);
        if (data.message) {
          const msg = data.message as import('../types').ChatMessage;
          console.log('[DEBUG] 服务端添加消息:', msg);
          console.log('[DEBUG] 消息类型:', msg.messageType, '文件信息:', msg.file);
          addChatMessage(msg);
        } else {
          console.warn('[DEBUG] 服务端收到 new_chat_message 但没有 message 字段');
        }
        break;
    }
  };

  // 初始化
  useEffect(() => {
    fetchQRCode();
    fetchChats();

    const interval = setInterval(fetchQRCode, 10000);
    return () => clearInterval(interval);
  }, [fetchQRCode, fetchChats]);


  // 踢出用户
  const handleKickUser = async (userId: string) => {
    if (!confirm('确定踢出该用户？')) return;
    try {
      const res = await fetch('/api/kick-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        showToast('已踢出用户', 'success');
        fetchQRCode();
      }
    } catch {
      showToast('操作失败', 'error');
    }
  };

  // 清空聊天
  const handleClearChat = async () => {
    if (!confirm('确定清空所有聊天记录？')) return;
    try {
      const res = await fetch('/api/clear-chat', { method: 'POST' });
      if (res.ok) {
        setChatMessages([]);
        showToast('已清空聊天记录', 'success');
      }
    } catch {
      showToast('操作失败', 'error');
    }
  };

  // 清除指定用户的聊天记录
  const handleClearUserChat = async (userId: string, userName: string) => {
    if (!confirm(`确定清除 ${userName} 的聊天记录？`)) return;
    try {
      const res = await fetch('/api/clear-user-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        const data = await res.json();
        fetchChats(); // 重新获取聊天记录
        showToast(`已清除 ${userName} 的聊天记录（${data.clearedCount || 0} 条）`, 'success');
      } else {
        showToast('操作失败', 'error');
      }
    } catch {
      showToast('操作失败', 'error');
    }
  };

  // 打开文件管理器
  const handleOpenInFinder = async (filename: string, category: string) => {
    try {
      console.log('[DEBUG] 调用 handleOpenInFinder:', filename, category);
      const res = await fetch('/api/open-in-finder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, category }),
      });
      if (!res.ok) {
        const error = await res.json();
        console.error('[DEBUG] 打开文件失败:', error);
        showToast(`打开失败: ${error.error || '未知错误'}`, 'error');
      } else {
        showToast('已在 Finder 中打开', 'success');
      }
    } catch (error) {
      console.error('[DEBUG] 打开文件异常:', error);
      showToast('打开失败', 'error');
    }
  };

  // 服务端发送消息给客户端
  const handleSendMessage = async () => {
    if (!serverMessage.trim() || !selectedUserId) return;
    
    setSendingMessage(true);
    try {
      const res = await fetch('/api/server-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          targetUserId: selectedUserId,
          content: serverMessage.trim(),
        }),
      });
      if (res.ok) {
        setServerMessage('');
      } else {
        showToast('发送失败', 'error');
      }
    } catch {
      showToast('发送失败', 'error');
    } finally {
      setSendingMessage(false);
    }
  };

  // 服务端上传文件给客户端
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedUserId) return;
    
    const file = files[0];
    const formData = new FormData();
    formData.append('files', file);
    formData.append('targetUserId', selectedUserId);
    
    try {
      const res = await fetch('/api/server-upload', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        showToast('发送成功', 'success');
      } else {
        showToast('发送失败', 'error');
      }
    } catch {
      showToast('发送失败', 'error');
    }
    
    e.target.value = '';
  };

  return (
    <div className="page-container" style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)' }}>
      {/* 状态栏 */}
      <div
        className="status-bar"
        style={{
          background: 'rgba(255,255,255,0.95)',
          marginBottom: 'var(--space-3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <div className={`connection-dot ${wsConnected ? 'connected' : 'disconnected'}`} />
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            {wsConnected ? t('statusBar.serviceRunning') : t('common.connecting')}
          </span>
          <span
            style={{
              fontSize: 'var(--text-xs)',
              padding: 'var(--space-1) var(--space-2)',
              background: 'var(--success-light)',
              borderRadius: 'var(--radius-full)',
              color: 'var(--success)',
            }}
          >
            {users.length} / {qrData?.maxConnections || 3}
          </span>
        </div>
        <span
          style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 700,
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          🌉 LAN Bridge
        </span>
      </div>

      {/* 二维码区域（可折叠） */}
      <div
        style={{
          background: 'rgba(255,255,255,0.95)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: 'var(--space-3)',
          overflow: 'hidden',
        }}
      >
        <button
          onClick={() => setShowQR(!showQR)}
          style={{
            width: '100%',
            padding: 'var(--space-3)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontWeight: 600 }}>📱 {t('qrCodePanel.title')}</span>
          <span>{showQR ? '▲' : '▼'}</span>
        </button>
        {showQR && (
          <div style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
            {qrData?.qrcode ? (
              <img
                src={qrData.qrcode}
                alt="QR Code"
                style={{ width: '180px', height: '180px', borderRadius: 'var(--radius)' }}
              />
            ) : (
              <div style={{ width: '180px', height: '180px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                加载中...
              </div>
            )}
            <div
              style={{
                marginTop: 'var(--space-3)',
                padding: 'var(--space-2)',
                background: 'var(--warning-light)',
                borderRadius: 'var(--radius)',
                fontSize: 'var(--text-xs)',
                color: 'var(--warning)',
              }}
            >
              {t('qrCodePanel.sameNetwork')}
            </div>
          </div>
        )}
      </div>

      {/* Tab 切换 */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-3)',
        }}
      >
        {[
          { id: 'chat' as const, icon: '💬', label: t('tabs.chat') },
          { id: 'users' as const, icon: '👥', label: t('tabs.connections') },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: 'var(--space-3)',
              background: activeTab === tab.id ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.5)',
              border: 'none',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? 600 : 400,
              transition: 'all var(--transition)',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* 内容区域 */}
      <div
        style={{
          flex: 1,
          background: 'rgba(255,255,255,0.95)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {activeTab === 'chat' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                padding: 'var(--space-3)',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontWeight: 600 }}>💬 {t('chatPanel.title')}</span>
              <button
                onClick={handleClearChat}
                style={{
                  padding: 'var(--space-1) var(--space-3)',
                  background: 'var(--danger-light)',
                  color: 'var(--danger)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-xs)',
                  cursor: 'pointer',
                }}
              >
                {t('common.clear')}
              </button>
            </div>
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {/* 用户列表侧边栏 */}
              <div
                style={{
                  width: '120px',
                  borderRight: '1px solid var(--border)',
                  overflow: 'auto',
                  background: 'var(--bg)',
                }}
              >
                {chatUsers.length === 0 ? (
                  <div style={{ padding: 'var(--space-3)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>
                    暂无消息
                  </div>
                ) : (
                  chatUsers.map((user) => (
                    <div
                      key={user.id}
                      onClick={() => setSelectedUserId(user.id)}
                      style={{
                        padding: 'var(--space-2) var(--space-3)',
                        cursor: 'pointer',
                        background: selectedUserId === user.id ? 'var(--primary-light)' : 'transparent',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>{user.avatar}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 'var(--text-xs)',
                          fontWeight: selectedUserId === user.id ? 600 : 400,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {user.name}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                          {messagesByUser[user.id]?.messages.length || 0} 条
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClearUserChat(user.id, user.name);
                        }}
                        style={{
                          padding: 'var(--space-1)',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '14px',
                          opacity: 0.6,
                        }}
                        title="清除该用户的聊天记录"
                      >
                        🗑️
                      </button>
                    </div>
                  ))
                )}
              </div>
              {/* 消息区域 */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                {!selectedUserId ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)' }}>
                    选择左侧用户查看消息
                  </div>
                ) : (
                  <ServerChatMessages 
                    messages={currentMessages} 
                    onOpenInFinder={handleOpenInFinder}
                  />
                )}
                {/* 服务端发送消息区域 */}
                {selectedUserId && (
                  <div style={{ 
                    padding: 'var(--space-2)', 
                    borderTop: '1px solid var(--border)',
                    display: 'flex',
                    gap: 'var(--space-2)',
                    alignItems: 'center',
                    background: 'var(--card)',
                  }}>
                    <input
                      type="text"
                      value={serverMessage}
                      onChange={(e) => setServerMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                      placeholder="输入消息..."
                      style={{
                        flex: 1,
                        padding: 'var(--space-2)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        fontSize: 'var(--text-sm)',
                        outline: 'none',
                      }}
                    />
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        padding: 'var(--space-2)',
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        cursor: 'pointer',
                        fontSize: '16px',
                      }}
                      title="发送文件"
                    >
                      📎
                    </button>
                    <button
                      onClick={handleSendMessage}
                      disabled={sendingMessage || !serverMessage.trim()}
                      style={{
                        padding: 'var(--space-2) var(--space-3)',
                        background: sendingMessage || !serverMessage.trim() ? 'var(--text-tertiary)' : 'var(--primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'var(--radius)',
                        cursor: sendingMessage || !serverMessage.trim() ? 'not-allowed' : 'pointer',
                        fontSize: 'var(--text-sm)',
                      }}
                    >
                      发送
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div style={{ padding: 'var(--space-3)' }}>
            <div style={{ marginBottom: 'var(--space-3)', fontWeight: 600 }}>
              👥 {t('connectionList.title')} ({users.length})
            </div>
            {users.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 'var(--space-6)' }}>
                {t('connectionList.noConnections')}
              </div>
            ) : (
              users.map((user) => (
                <div
                  key={user.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3)',
                    background: 'var(--bg)',
                    borderRadius: 'var(--radius)',
                    marginBottom: 'var(--space-2)',
                  }}
                >
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      background: 'var(--card)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '22px',
                    }}
                  >
                    {user.avatar}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{user.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                      {new Date(user.connectedAt).toLocaleTimeString('zh-CN')}
                    </div>
                  </div>
                  <button
                    onClick={() => handleKickUser(user.id)}
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      background: 'var(--danger)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--text-xs)',
                      cursor: 'pointer',
                    }}
                  >
                    踢出
                  </button>
                </div>
              ))
            )}
          </div>
        )}

      </div>

      <ToastContainer />
    </div>
  );
}

// 服务端聊天消息组件
function ServerChatMessages({
  messages,
  onOpenInFinder,
}: {
  messages: ChatMessage[];
  onOpenInFinder: (filename: string, category: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages.length]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  return (
    <div 
      ref={containerRef} 
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: 'var(--space-3)',
        overflowY: 'auto',
        flex: 1,
        minHeight: 0,
        padding: 'var(--space-2)',
        maxHeight: 'calc(100vh - 300px)',
      }}
    >
      {messages.map((msg) => {
        const isUser = msg.role === 'user';
        const isFile = msg.messageType && ['image', 'video', 'file'].includes(msg.messageType);
        const file = msg.file;
        
        // 调试日志 - 所有消息都记录
        console.log('[DEBUG] 服务端渲染消息:', {
          id: msg.id,
          role: msg.role,
          messageType: msg.messageType || 'text',
          hasFile: !!file,
          file: file ? { filename: file.filename, category: file.category, size: file.size } : null,
          content: msg.content?.substring(0, 50),
        });

        return (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: isUser ? 'flex-start' : 'flex-end', // 修复：user在左边，ai在右边
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                marginBottom: 'var(--space-1)',
                flexDirection: isUser ? 'row' : 'row-reverse', // 修复：user头像在左，ai头像在右
              }}
            >
              <span style={{ fontSize: '14px' }}>{msg.userAvatar}</span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                {msg.time}
              </span>
            </div>
            <div
              style={{
                maxWidth: '85%',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: isUser
                  ? 'var(--radius-lg) var(--radius-lg) var(--radius-lg) var(--radius-xs)'
                  : 'var(--radius-lg) var(--radius-lg) var(--radius-xs) var(--radius-lg)',
                background: isUser ? 'var(--card)' : 'var(--primary)', // 修复：user用card样式，ai用primary样式
                color: isUser ? 'var(--text)' : 'white',
                boxShadow: 'var(--shadow-sm)',
                fontSize: 'var(--text-sm)',
              }}
            >
              {isFile && file ? (
                <div>
                  {msg.messageType === 'image' && (
                    <img
                      src={`/files/${encodeURIComponent(file.filename)}?category=${file.category || 'images'}`}
                      alt={file.filename}
                      onClick={() => {
                        const img = new Image();
                        img.src = `/files/${encodeURIComponent(file.filename)}?category=${file.category || 'images'}`;
                        const w = window.open('', '_blank');
                        if (w) {
                          w.document.write(`<html><head><title>${file.filename}</title></head><body style="margin:0;display:flex;justify-content:center;align-items:center;height:100vh;background:#000;"><img src="${img.src}" style="max-width:100%;max-height:100%;object-fit:contain;" /></body></html>`);
                        }
                      }}
                      style={{ maxWidth: '100%', maxHeight: '150px', borderRadius: 'var(--radius)', marginBottom: 'var(--space-2)', cursor: 'pointer' }}
                    />
                  )}
                  {msg.messageType === 'video' && (
                    <video
                      src={`/files/${encodeURIComponent(file.filename)}?category=${file.category || 'videos'}`}
                      controls
                      style={{ maxWidth: '100%', maxHeight: '150px', borderRadius: 'var(--radius)', marginBottom: 'var(--space-2)' }}
                    />
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ fontSize: '20px' }}>
                      {msg.messageType === 'image' ? '🖼️' : msg.messageType === 'video' ? '🎬' : '📎'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--text-xs)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {file.filename}
                      </div>
                      <div style={{ fontSize: '10px', opacity: 0.7 }}>{formatSize(file.size)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                    <button
                      onClick={() => window.open(`/files/${encodeURIComponent(file.filename)}?category=${file.category}`, '_blank')}
                      style={{
                        padding: 'var(--space-1) var(--space-2)',
                        background: isUser ? 'rgba(255,255,255,0.2)' : 'var(--primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '10px',
                        cursor: 'pointer',
                      }}
                    >
                      下载
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('[DEBUG] 点击定位按钮:', file.filename, file.category);
                        onOpenInFinder(file.filename, file.category || 'files');
                      }}
                      style={{
                        padding: 'var(--space-1) var(--space-2)',
                        background: isUser ? 'rgba(255,255,255,0.2)' : 'var(--bg)',
                        color: isUser ? 'white' : 'var(--text)',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '10px',
                        cursor: 'pointer',
                      }}
                    >
                      📂
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ lineHeight: 1.5, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                  {String(msg.content || '')}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
