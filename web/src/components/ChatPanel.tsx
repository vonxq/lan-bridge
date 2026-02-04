import { useRef, useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { useTranslation } from '../i18n/I18nContext';
import { Button } from './common';
import type { ChatMessage } from '../types';

interface ChatPanelProps {
  onClear: () => void;
  onOpenInFinder?: (filename: string, category: string) => void;
}

export function ChatPanel({ onClear, onOpenInFinder }: ChatPanelProps) {
  const { chatMessages, users, selectedUserId, setSelectedUserId } = useAppStore();
  const listRef = useRef<HTMLDivElement>(null);
  const t = useTranslation();

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
    if (confirm(t('chatPanel.clearConfirm'))) {
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
            {t('chatPanel.allUsers')}
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
          <span style={{ fontSize: '14px', fontWeight: 600 }}>💬 {t('chatPanel.title')}</span>
          <Button size="sm" variant="danger" onClick={handleClear}>
            {t('common.clear')}
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
              {t('chatPanel.noMessages')}
            </div>
          ) : (
            filteredMessages.map((message) => (
              <MessageItem 
                key={message.id} 
                message={message} 
                onOpenInFinder={onOpenInFinder}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// 消息项组件
function MessageItem({ 
  message, 
  onOpenInFinder 
}: { 
  message: ChatMessage; 
  onOpenInFinder?: (filename: string, category: string) => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const isFile = message.messageType && message.messageType !== 'text';
  const file = message.file;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  const getFileIcon = () => {
    if (!file) return '📎';
    if (message.messageType === 'image') return '🖼️';
    if (message.messageType === 'video') return '🎬';
    return '📎';
  };

  const handleOpenInFinder = () => {
    if (file && onOpenInFinder) {
      onOpenInFinder(file.filename, file.category);
    }
  };

  return (
    <div
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--bg)',
        background: message.role === 'user' ? '#f0f4ff' : '#f0fff4',
      }}
    >
      {/* 消息头部 */}
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

      {/* 消息内容 */}
      {isFile && file ? (
        <div
          style={{
            background: 'white',
            borderRadius: '12px',
            padding: '12px',
            border: '1px solid var(--border)',
          }}
        >
          {/* 图片预览 */}
          {message.messageType === 'image' && (
            <div style={{ marginBottom: '8px' }}>
              <img
                src={`/files/${encodeURIComponent(file.filename)}?category=${file.category}`}
                alt={file.filename}
                style={{
                  maxWidth: '100%',
                  maxHeight: '200px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
                onClick={() => setPreviewOpen(true)}
              />
            </div>
          )}

          {/* 视频预览 */}
          {message.messageType === 'video' && (
            <div style={{ marginBottom: '8px' }}>
              <video
                src={`/files/${encodeURIComponent(file.filename)}?category=${file.category}`}
                controls
                style={{
                  maxWidth: '100%',
                  maxHeight: '200px',
                  borderRadius: '8px',
                }}
              />
            </div>
          )}

          {/* 文件信息 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '32px' }}>{getFileIcon()}</span>
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
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {formatSize(file.size)}
              </div>
            </div>
            
            {/* 操作按钮 */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => window.open(`/files/${encodeURIComponent(file.filename)}?category=${file.category}`, '_blank')}
                style={{
                  padding: '6px 12px',
                  background: 'var(--primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                下载
              </button>
              {onOpenInFinder && (
                <button
                  onClick={handleOpenInFinder}
                  style={{
                    padding: '6px 12px',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  📂 定位
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
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
      )}

      {/* 图片预览模态框 */}
      {previewOpen && file && message.messageType === 'image' && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setPreviewOpen(false)}
        >
          <img
            src={`/files/${encodeURIComponent(file.filename)}?category=${file.category}`}
            alt={file.filename}
            style={{
              maxWidth: '90%',
              maxHeight: '90%',
              objectFit: 'contain',
            }}
          />
          <button
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              color: 'white',
              fontSize: '20px',
              cursor: 'pointer',
            }}
            onClick={() => setPreviewOpen(false)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
