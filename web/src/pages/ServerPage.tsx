import { useState, useEffect, useCallback } from 'react';
import { Tabs, ToastContainer } from '../components/common';
import { showToast } from '../components/common/Toast';
import { Settings } from '../components';
import type { User, FileInfo, ChatMessage } from '../types';

interface QRCodeData {
  qrcode: string;
  url: string;
  connections: number;
  maxConnections: number;
  users: User[];
}

export function ServerPage() {
  const [qrData, setQrData] = useState<QRCodeData | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [wsConnected, setWsConnected] = useState(false);

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

  // 获取文件列表
  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/files?category=all');
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      }
    } catch (e) {
      console.error('获取文件列表失败:', e);
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
  }, []);

  // WebSocket 连接（服务端使用 server_token）
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // 从 window 或 URL 获取 server_token
    const serverToken = (window as { SERVER_TOKEN?: string }).SERVER_TOKEN || 
      new URLSearchParams(window.location.search).get('server_token') || '';
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
      // 3秒后重连
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
        setUsers(prev => [...prev, data.user as User]);
        showToast(`${(data.user as User).name} 已连接`, 'info');
        break;
      case 'user_disconnected':
        setUsers(prev => prev.filter(u => u.id !== data.userId));
        break;
      case 'chat_history':
      case 'new_chat_message':
        fetchChats();
        break;
      case 'file_uploaded':
        fetchFiles();
        break;
    }
  };

  // 初始化
  useEffect(() => {
    fetchQRCode();
    fetchFiles();
    fetchChats();
    
    // 定期刷新二维码
    const interval = setInterval(fetchQRCode, 10000);
    return () => clearInterval(interval);
  }, [fetchQRCode, fetchFiles, fetchChats]);

  // 删除文件
  const handleDeleteFile = async (filename: string, category: string) => {
    try {
      const res = await fetch('/api/files/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, category }),
      });
      if (res.ok) {
        showToast('删除成功', 'success');
        fetchFiles();
      }
    } catch (e) {
      showToast('删除失败', 'error');
    }
  };

  // 踢出用户
  const handleKickUser = async (userId: string) => {
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
    } catch (e) {
      showToast('操作失败', 'error');
    }
  };

  // 清空聊天
  const handleClearChat = async () => {
    try {
      const res = await fetch('/api/clear-chat', { method: 'POST' });
      if (res.ok) {
        setChatMessages([]);
        showToast('已清空聊天记录', 'success');
      }
    } catch (e) {
      showToast('操作失败', 'error');
    }
  };

  // 保存设置
  const handleSaveSettings = async (settings: { maxConnections: number }) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        showToast('设置已保存', 'success');
        fetchQRCode();
      }
    } catch (e) {
      showToast('保存失败', 'error');
    }
  };

  const tabs = [
    {
      id: 'qrcode',
      label: '二维码',
      icon: '📱',
      content: (
        <QRCodePanel
          qrData={qrData}
          onRefresh={fetchQRCode}
        />
      ),
    },
    {
      id: 'connections',
      label: '连接',
      icon: '👥',
      content: (
        <ServerConnectionList
          users={users}
          maxConnections={qrData?.maxConnections || 3}
          onKick={handleKickUser}
        />
      ),
    },
    {
      id: 'chat',
      label: '聊天',
      icon: '💬',
      content: (
        <ServerChatPanel
          messages={chatMessages}
          users={users}
          onClear={handleClearChat}
        />
      ),
    },
    {
      id: 'files',
      label: '文件',
      icon: '📁',
      content: (
        <ServerFilePanel
          files={files}
          onRefresh={fetchFiles}
          onDelete={handleDeleteFile}
        />
      ),
    },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
        padding: 'var(--space-6)',
      }}
    >
      <div
        style={{
          maxWidth: '900px',
          margin: '0 auto',
          animation: 'fadeIn var(--transition-slow) ease',
        }}
      >
        {/* 标题 */}
        <div
          style={{
            textAlign: 'center',
            marginBottom: 'var(--space-6)',
            color: 'white',
          }}
        >
          <h1 
            style={{ 
              fontSize: 'var(--text-3xl)', 
              fontWeight: 700,
              marginBottom: 'var(--space-2)',
              textShadow: '0 2px 10px rgba(0,0,0,0.2)',
            }}
          >
            🌉 LAN Bridge
          </h1>
          <p style={{ opacity: 0.9, fontSize: 'var(--text-base)' }}>
            内网桥接工具 - 服务端控制台
          </p>
        </div>

        {/* 主卡片 */}
        <div
          style={{
            background: 'var(--card)',
            borderRadius: 'var(--radius-2xl)',
            padding: 'var(--space-6)',
            boxShadow: 'var(--shadow-xl)',
          }}
        >
          {/* 状态栏 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-5)',
              padding: 'var(--space-4)',
              background: 'var(--bg)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: 'var(--radius-full)',
                  background: wsConnected ? 'var(--success)' : 'var(--danger)',
                  animation: wsConnected ? 'pulse 2s infinite' : 'none',
                  boxShadow: wsConnected 
                    ? '0 0 8px rgba(16, 185, 129, 0.5)' 
                    : '0 0 8px rgba(239, 68, 68, 0.5)',
                }}
              />
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 500 }}>
                {wsConnected ? '服务运行中' : '连接中...'}
              </span>
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  padding: 'var(--space-1) var(--space-3)',
                  background: 'var(--success-light)',
                  borderRadius: 'var(--radius-full)',
                  color: 'var(--success)',
                  fontWeight: 600,
                }}
              >
                {users.length} / {qrData?.maxConnections || 3} 连接
              </span>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              style={{
                background: 'var(--card)',
                border: 'none',
                fontSize: '22px',
                cursor: 'pointer',
                padding: 'var(--space-2)',
                borderRadius: 'var(--radius)',
                boxShadow: 'var(--shadow)',
                transition: 'all var(--transition)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'var(--shadow)';
              }}
            >
              ⚙️
            </button>
          </div>

          {/* Tab 内容 */}
          <Tabs tabs={tabs} defaultTab="qrcode" />
        </div>
      </div>

      {/* 设置模态框 */}
      <Settings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={handleSaveSettings}
      />

      <ToastContainer />
    </div>
  );
}

// 二维码面板
function QRCodePanel({
  qrData,
  onRefresh,
}: {
  qrData: QRCodeData | null;
  onRefresh: () => void;
}) {
  return (
    <div style={{ textAlign: 'center' }}>
      {/* 二维码 */}
      <div
        style={{
          background: '#f8f9fa',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '20px',
          display: 'inline-block',
        }}
      >
        {qrData?.qrcode ? (
          <img
            src={qrData.qrcode}
            alt="扫码连接"
            style={{ width: '200px', height: '200px', borderRadius: '8px' }}
          />
        ) : (
          <div style={{ width: '200px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
            加载中...
          </div>
        )}
      </div>

      {/* 提示 */}
      <div
        style={{
          padding: '16px',
          background: '#fff3e0',
          borderRadius: '12px',
          fontSize: '14px',
          color: '#e65100',
          marginBottom: '16px',
        }}
      >
        📱 使用手机浏览器扫描二维码连接
        <br />
        ⚠️ 请确保手机和电脑在同一网络
      </div>

      {/* 刷新按钮 */}
      <button
        onClick={onRefresh}
        style={{
          padding: '10px 24px',
          background: '#667eea',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '14px',
          cursor: 'pointer',
        }}
      >
        🔄 刷新二维码
      </button>

      {/* 在线用户 */}
      {qrData?.users && qrData.users.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <p style={{ fontSize: '13px', color: '#888', marginBottom: '12px' }}>在线用户</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {qrData.users.map((user) => (
              <div
                key={user.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  background: '#f0f4ff',
                  borderRadius: '20px',
                  fontSize: '13px',
                }}
              >
                <span>{user.avatar}</span>
                <span>{user.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// 服务端连接列表
function ServerConnectionList({
  users,
  maxConnections,
  onKick,
}: {
  users: User[];
  maxConnections: number;
  onKick: (userId: string) => void;
}) {
  if (users.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
        暂无连接
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '12px', fontSize: '13px', color: '#888' }}>
        当前连接: {users.length} / {maxConnections}
      </div>
      {users.map((user) => (
        <div
          key={user.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            background: '#f8f9fa',
            borderRadius: '12px',
            marginBottom: '8px',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#e8f5e9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
            }}
          >
            {user.avatar}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{user.name}</div>
            <div style={{ fontSize: '12px', color: '#888' }}>
              连接于 {new Date(user.connectedAt).toLocaleTimeString('zh-CN')}
            </div>
          </div>
          <button
            onClick={() => {
              if (confirm(`确定踢出 ${user.name}？`)) {
                onKick(user.id);
              }
            }}
            style={{
              padding: '6px 12px',
              background: '#FF3B30',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            踢出
          </button>
        </div>
      ))}
    </div>
  );
}

// 服务端聊天面板
function ServerChatPanel({
  messages,
  users,
  onClear,
}: {
  messages: ChatMessage[];
  users: User[];
  onClear: () => void;
}) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  void users; // 用于避免未使用警告

  const filteredMessages = selectedUserId
    ? messages.filter((m) => m.userId === selectedUserId || m.role === 'ai')
    : messages;

  return (
    <div>
      {/* 用户筛选 */}
      {users.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setSelectedUserId(null)}
            style={{
              padding: '6px 12px',
              border: 'none',
              background: !selectedUserId ? '#667eea' : '#f0f0f0',
              color: !selectedUserId ? 'white' : '#333',
              borderRadius: '16px',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            全部
          </button>
          {users.map((user) => (
            <button
              key={user.id}
              onClick={() => setSelectedUserId(user.id)}
              style={{
                padding: '6px 12px',
                border: 'none',
                background: selectedUserId === user.id ? '#667eea' : '#f0f0f0',
                color: selectedUserId === user.id ? 'white' : '#333',
                borderRadius: '16px',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {user.avatar} {user.name}
            </button>
          ))}
        </div>
      )}

      {/* 消息列表 */}
      <div
        style={{
          maxHeight: '400px',
          overflowY: 'auto',
          background: '#f8f9fa',
          borderRadius: '12px',
          marginBottom: '12px',
        }}
      >
        {filteredMessages.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
            暂无聊天记录
          </div>
        ) : (
          filteredMessages.map((msg) => (
            <div
              key={msg.id}
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid #eee',
                background: msg.role === 'ai' ? '#f0fff4' : 'white',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span>{msg.userAvatar}</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: msg.role === 'ai' ? '#34C759' : '#667eea' }}>
                  {msg.userName}
                </span>
                <span style={{ fontSize: '11px', color: '#888' }}>{msg.time}</span>
              </div>
              <div style={{ fontSize: '14px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {msg.content}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 清空按钮 */}
      <button
        onClick={() => {
          if (confirm('确定清空所有聊天记录？')) {
            onClear();
          }
        }}
        style={{
          padding: '8px 16px',
          background: '#FF3B30',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '13px',
          cursor: 'pointer',
        }}
      >
        清空记录
      </button>
    </div>
  );
}

// 服务端文件面板
function ServerFilePanel({
  files,
  onRefresh,
  onDelete,
}: {
  files: FileInfo[];
  onRefresh: () => void;
  onDelete: (filename: string, category: string) => void;
}) {
  const [category, setCategory] = useState<'all' | 'images' | 'videos' | 'files'>('all');

  const filteredFiles = files.filter((f) => category === 'all' || f.category === category);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  const getIcon = (file: FileInfo) => {
    if (file.category === 'images') return '🖼️';
    if (file.category === 'videos') return '🎬';
    return '📎';
  };

  return (
    <div>
      {/* 分类筛选 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        {(['all', 'images', 'videos', 'files'] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            style={{
              padding: '6px 12px',
              border: 'none',
              background: category === cat ? '#667eea' : '#f0f0f0',
              color: category === cat ? 'white' : '#333',
              borderRadius: '16px',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            {cat === 'all' ? '全部' : cat === 'images' ? '图片' : cat === 'videos' ? '视频' : '文件'}
          </button>
        ))}
        <button
          onClick={onRefresh}
          style={{
            marginLeft: 'auto',
            padding: '6px 12px',
            border: 'none',
            background: '#f0f0f0',
            borderRadius: '16px',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          🔄 刷新
        </button>
      </div>

      {/* 文件列表 */}
      <div
        style={{
          maxHeight: '400px',
          overflowY: 'auto',
          background: '#f8f9fa',
          borderRadius: '12px',
        }}
      >
        {filteredFiles.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
            暂无文件
          </div>
        ) : (
          filteredFiles.map((file) => (
            <div
              key={file.filename}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderBottom: '1px solid #eee',
                background: 'white',
              }}
            >
              <span style={{ fontSize: '28px' }}>{getIcon(file)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {file.filename}
                </div>
                <div style={{ fontSize: '12px', color: '#888' }}>
                  {formatSize(file.size)}
                </div>
              </div>
              <button
                onClick={() => window.open(`/files/${encodeURIComponent(file.filename)}?category=${file.category}`, '_blank')}
                style={{
                  padding: '6px 12px',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                下载
              </button>
              <button
                onClick={() => {
                  if (confirm(`确定删除 ${file.filename}？`)) {
                    onDelete(file.filename, file.category);
                  }
                }}
                style={{
                  padding: '6px 12px',
                  background: '#FF3B30',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                删除
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
