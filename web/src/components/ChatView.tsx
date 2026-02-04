import { useRef, useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { useTranslation } from '../i18n/I18nContext';
import type { ChatMessage } from '../types';

interface ChatViewProps {
  onOpenInFinder?: (filename: string, category: string) => void;
  isServerView?: boolean;  // 服务端才显示下载和定位按钮
}

export function ChatView({ onOpenInFinder, isServerView = false }: ChatViewProps) {
  const { chatMessages, currentUser } = useAppStore();
  const listRef = useRef<HTMLDivElement>(null);
  const t = useTranslation();

  // 过滤消息：只显示当前用户的消息 + AI 回复
  const filteredMessages = chatMessages.filter((msg) => {
    // AI 回复始终显示
    if (msg.role === 'ai') return true;
    // 只显示当前用户的消息
    if (currentUser && msg.userId === currentUser.id) return true;
    // 如果没有 currentUser 信息，显示所有 user 消息（兼容旧数据）
    if (!currentUser && msg.role === 'user') return true;
    return false;
  });

  // 反转消息顺序：从新到旧（最新的在最上面）
  const reversedMessages = [...filteredMessages].reverse();

  // 自动滚动到顶部（因为最新消息在顶部）
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [reversedMessages.length]);

  return (
    <div
      ref={listRef}
      className="chat-view"
      style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: 'var(--space-3)',
        background: 'var(--bg)',
        borderRadius: 'var(--radius-lg)',
        minHeight: 0,
      }}
    >
      {filteredMessages.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-tertiary)',
            fontSize: 'var(--text-sm)',
            gap: 'var(--space-2)',
          }}
        >
          <span style={{ fontSize: '48px', opacity: 0.5 }}>💬</span>
          <span>{t('chatPanel.noMessages')}</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {reversedMessages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onOpenInFinder={onOpenInFinder}
              isServerView={isServerView}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// 消息气泡组件
function MessageBubble({
  message,
  onOpenInFinder,
  isServerView = false,
}: {
  message: ChatMessage;
  onOpenInFinder?: (filename: string, category: string) => void;
  isServerView?: boolean;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const isUser = message.role === 'user';
  const isFile = message.messageType && ['image', 'video', 'file'].includes(message.messageType);
  const file = message.file;
  
  // 调试日志 - 所有消息都记录
  useEffect(() => {
    console.log('[DEBUG] 客户端渲染消息:', {
      id: message.id,
      role: message.role,
      messageType: message.messageType || 'text',
      hasFile: !!file,
      file: file ? { filename: file.filename, category: file.category, size: file.size } : null,
      content: message.content?.substring(0, 50),
    });
  }, [message.id]);

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

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      {/* 头像和名字 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-1)',
          flexDirection: isUser ? 'row-reverse' : 'row',
        }}
      >
        <span style={{ fontSize: '16px' }}>{message.userAvatar}</span>
        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-tertiary)',
          }}
        >
          {message.userName} · {message.time}
        </span>
      </div>

      {/* 气泡内容 */}
      <div
        className={`message-bubble ${isUser ? 'user' : 'ai'}`}
        style={{
          maxWidth: '85%',
          padding: 'var(--space-3) var(--space-4)',
          borderRadius: isUser
            ? 'var(--radius-lg) var(--radius-lg) var(--radius-xs) var(--radius-lg)'
            : 'var(--radius-lg) var(--radius-lg) var(--radius-lg) var(--radius-xs)',
          background: isUser ? 'var(--primary)' : 'var(--card)',
          color: isUser ? 'white' : 'var(--text)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {isFile && file ? (
          <div>
            {/* 图片预览 */}
            {message.messageType === 'image' && !imageError && (
              <div style={{ marginBottom: 'var(--space-2)' }}>
                <img
                  src={`/files/${encodeURIComponent(file.filename)}?category=${file.category || 'images'}`}
                  alt={file.filename}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '200px',
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    console.log('[DEBUG] 点击图片预览:', file.filename, file.category);
                    setPreviewOpen(true);
                  }}
                  onError={(e) => {
                    console.error('[DEBUG] 图片加载失败:', file.filename, file.category, e);
                    setImageError(true);
                  }}
                />
              </div>
            )}

            {/* 视频预览 */}
            {message.messageType === 'video' && (
              <div style={{ marginBottom: 'var(--space-2)' }}>
                <video
                  src={`/files/${encodeURIComponent(file.filename)}?category=${file.category || 'videos'}`}
                  controls
                  style={{
                    maxWidth: '100%',
                    maxHeight: '200px',
                    borderRadius: 'var(--radius)',
                  }}
                />
              </div>
            )}

            {/* 文件信息 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ fontSize: '24px' }}>{getFileIcon()}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {file.filename}
                </div>
                <div
                  style={{
                    fontSize: 'var(--text-xs)',
                    opacity: 0.7,
                  }}
                >
                  {formatSize(file.size)}
                </div>
              </div>
            </div>

            {/* 操作按钮（仅服务端显示） */}
            {isServerView && (
              <div
                style={{
                  display: 'flex',
                  gap: 'var(--space-2)',
                  marginTop: 'var(--space-2)',
                }}
              >
                <button
                  onClick={() =>
                    window.open(
                      `/files/${encodeURIComponent(file.filename)}?category=${file.category}`,
                      '_blank'
                    )
                  }
                  style={{
                    padding: 'var(--space-1) var(--space-3)',
                    background: isUser ? 'rgba(255,255,255,0.2)' : 'var(--primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--text-xs)',
                    cursor: 'pointer',
                  }}
                >
                  下载
                </button>
                {onOpenInFinder && (
                  <button
                    onClick={() => onOpenInFinder(file.filename, file.category)}
                    style={{
                      padding: 'var(--space-1) var(--space-3)',
                      background: isUser ? 'rgba(255,255,255,0.2)' : 'var(--bg)',
                      color: isUser ? 'white' : 'var(--text)',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--text-xs)',
                      cursor: 'pointer',
                    }}
                  >
                    📂 定位
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              fontSize: 'var(--text-sm)',
              lineHeight: 1.6,
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
            }}
          >
            {String(message.content || '')}
          </div>
        )}
      </div>

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
