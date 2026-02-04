import { useRef, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { Button } from './common';

interface ChatPanelProps {
  onClear: () => void;
}

export function ChatPanel({ onClear }: ChatPanelProps) {
  const { chatMessages, users, selectedUserId, setSelectedUserId } = useAppStore();
  const listRef = useRef<HTMLDivElement>(null);

  // 过滤消息
  const filteredMessages = selectedUserId
    ? chatMessages.filter((m) => m.userId === selectedUserId || m.role === 'ai')
    : chatMessages;

  // 自动滚动到底部
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [filteredMessages]);

  const handleClear = () => {
    if (confirm('确定清空聊天记录？')) {
      onClear();
    }
  };

  return (
    <div>
      {/* 用户筛选 */}
      {users.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '12px',
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={() => setSelectedUserId(null)}
            style={{
              padding: '6px 12px',
              border: 'none',
              background: !selectedUserId ? 'var(--primary)' : 'var(--bg)',
              color: !selectedUserId ? 'white' : 'var(--text)',
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
                background: selectedUserId === user.id ? 'var(--primary)' : 'var(--bg)',
                color: selectedUserId === user.id ? 'white' : 'var(--text)',
                borderRadius: '16px',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>{user.avatar}</span>
              <span>{user.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* 聊天记录 */}
      <div
        style={{
          background: 'var(--card)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow)',
          overflow: 'hidden',
        }}
      >
        {/* 头部 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid var(--bg)',
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: 600 }}>💬 聊天记录</span>
          <Button size="sm" variant="danger" onClick={handleClear}>
            清空
          </Button>
        </div>

        {/* 消息列表 */}
        <div
          ref={listRef}
          style={{
            maxHeight: '400px',
            overflowY: 'auto',
          }}
        >
          {filteredMessages.length === 0 ? (
            <div
              style={{
                padding: '32px',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                fontSize: '14px',
              }}
            >
              暂无聊天记录
            </div>
          ) : (
            filteredMessages.map((message) => (
              <div
                key={message.id}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--bg)',
                  background: message.role === 'user' ? '#f0f4ff' : '#f0fff4',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '6px',
                  }}
                >
                  <span style={{ fontSize: '16px' }}>{message.userAvatar}</span>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: message.role === 'user' ? 'var(--primary)' : 'var(--success)',
                    }}
                  >
                    {message.userName}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {message.time}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '14px',
                    lineHeight: 1.5,
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {message.content}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
