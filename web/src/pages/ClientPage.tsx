import { useState, useEffect, useRef, useCallback } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAppStore } from '../stores/appStore';
import { useTranslation } from '../i18n/I18nContext';
import { ToastContainer } from '../components/common';
import { showToast } from '../components/common/Toast';
import { ToolBar } from '../components/ToolBar';
import { ActionBar } from '../components/ActionBar';
import { ChatView } from '../components/ChatView';
import { OthersPage } from './OthersPage';
import type { ChatMessage } from '../types';

interface ClientPageProps {
  token: string;
  onTokenInvalid?: () => void;
  onRescan?: () => void;
}

// 上传中的文件信息
interface UploadingFile {
  id: string;
  filename: string;
  progress: number;
  type: 'image' | 'video' | 'file';
}

export function ClientPage({ token, onTokenInvalid, onRescan }: ClientPageProps) {
  const [showOthers, setShowOthers] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const { currentText, setCurrentText, connectionStatus, aiReplyEnabled, addChatMessage, currentUser } = useAppStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = useTranslation();

  const {
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
    send,
  } = useWebSocket({ token, onTokenInvalid });

  const isConnected = connectionStatus === 'connected';

  // 添加操作记录到聊天
  const logAction = useCallback((action: string, content: string) => {
    const message: ChatMessage = {
      id: Date.now().toString(),
      userId: currentUser?.id || 'unknown',
      userName: currentUser?.name || '我',
      userAvatar: currentUser?.avatar || '👤',
      role: 'user',
      content: `[${action}] ${content}`,
      timestamp: new Date().toISOString(),
      time: new Date().toLocaleTimeString('zh-CN'),
      messageType: 'action',
    };
    addChatMessage(message);
  }, [addChatMessage, currentUser]);

  // 初始加载
  useEffect(() => {
    getFiles();
  }, [getFiles]);

  // 处理文本变化
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setCurrentText(text);
    syncText(text);
  };

  // 清空文本
  const handleClear = () => {
    setCurrentText('');
    syncText('');
    logAction('清空', '已清空输入框');
  };

  // 包装操作函数，添加日志记录
  const handlePaste = () => {
    paste(aiReplyEnabled);
    logAction('粘贴', currentText.substring(0, 50) + (currentText.length > 50 ? '...' : ''));
  };

  const handleReplace = () => {
    replaceLine();
    logAction('替换', currentText.substring(0, 50) + (currentText.length > 50 ? '...' : ''));
  };

  const handleSubmit = () => {
    submit(aiReplyEnabled);
    // submit 已经在 useWebSocket 中添加了消息
  };

  const handleGetClipboard = () => {
    getClipboard();
    logAction('获取剪贴板', '请求中...');
  };

  const handleGetCurrentLine = () => {
    getCurrentLine();
    logAction('获取当前行', '请求中...');
  };

  const handleReconnect = () => {
    connect();
    logAction('重连', '正在重新连接...');
  };

  // 上传文件
  const uploadFile = useCallback(async (file: File, type: 'image' | 'video' | 'file') => {
    const uploadId = Date.now().toString();
    
    // 立即添加到上传列表（显示进度条）
    setUploadingFiles(prev => [...prev, {
      id: uploadId,
      filename: file.name,
      progress: 0,
      type,
    }]);

    // 添加上传开始消息到聊天
    const uploadMessage: ChatMessage = {
      id: uploadId,
      userId: currentUser?.id || 'unknown',
      userName: currentUser?.name || '我',
      userAvatar: currentUser?.avatar || '👤',
      role: 'user',
      content: `正在上传: ${file.name}`,
      timestamp: new Date().toISOString(),
      time: new Date().toLocaleTimeString('zh-CN'),
      messageType: type,
      file: {
        filename: file.name,
        size: file.size,
        category: type === 'image' ? 'images' : type === 'video' ? 'videos' : 'files',
        uploadTime: new Date().toISOString(),
      },
      uploadProgress: 0,
    };
    addChatMessage(uploadMessage);

    const formData = new FormData();
    formData.append('files', file);

    try {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploadingFiles(prev => 
            prev.map(f => f.id === uploadId ? { ...f, progress } : f)
          );
        }
      });

      xhr.addEventListener('load', () => {
        setUploadingFiles(prev => prev.filter(f => f.id !== uploadId));
        if (xhr.status === 200) {
          showToast(`上传成功: ${file.name}`, 'success');
          getFiles();
        } else {
          showToast('上传失败', 'error');
        }
      });

      xhr.addEventListener('error', () => {
        setUploadingFiles(prev => prev.filter(f => f.id !== uploadId));
        showToast('上传失败', 'error');
      });

      xhr.open('POST', `/api/upload?token=${token}`);
      xhr.send(formData);
    } catch {
      setUploadingFiles(prev => prev.filter(f => f.id !== uploadId));
      showToast('上传失败', 'error');
    }
  }, [token, currentUser, addChatMessage, getFiles]);

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'file') => {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach(file => uploadFile(file, type));
      e.target.value = '';
    }
  };

  // 如果显示 Others 页面
  if (showOthers) {
    return (
      <OthersPage
        token={token}
        onBack={() => setShowOthers(false)}
        onClearChat={clearChat}
        onDeleteFile={deleteFile}
        onRefreshFiles={getFiles}
        send={send}
      />
    );
  }

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* 状态栏 */}
      <div className="status-bar" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <div className={`connection-dot ${isConnected ? 'connected' : 'disconnected'}`} />
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            {isConnected ? t('statusBar.connected') : t('statusBar.disconnected')}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span
            style={{
              fontSize: 'var(--text-lg)',
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 700,
            }}
          >
            🌉 LAN Bridge
          </span>
          {/* 扫码重连按钮 */}
          <button
            onClick={onRescan}
            style={{
              padding: 'var(--space-1) var(--space-2)',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              fontSize: 'var(--text-xs)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
            }}
            title="扫码重连"
          >
            📷
          </button>
        </div>
      </div>

      {/* 工具栏 */}
      <ToolBar
        onGetClipboard={handleGetClipboard}
        onGetCurrentLine={handleGetCurrentLine}
        onReconnect={handleReconnect}
        onClear={handleClear}
        onMore={() => setShowOthers(true)}
        disabled={!isConnected}
      />

      {/* 操作按钮 */}
      <ActionBar
        onPaste={handlePaste}
        onReplace={handleReplace}
        onSubmit={handleSubmit}
        disabled={!isConnected}
      />

      {/* 上传按钮行 */}
      <div style={{
        flexShrink: 0, 
        display: 'flex', 
        gap: 'var(--space-2)', 
        padding: 'var(--space-2) 0',
      }}>
        <button
          onClick={() => imageInputRef.current?.click()}
          disabled={!isConnected}
          style={{
            flex: 1,
            padding: 'var(--space-2)',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            fontSize: 'var(--text-sm)',
            cursor: isConnected ? 'pointer' : 'not-allowed',
            opacity: isConnected ? 1 : 0.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-1)',
          }}
        >
          🖼️ 图片
        </button>
        <button
          onClick={() => videoInputRef.current?.click()}
          disabled={!isConnected}
          style={{
            flex: 1,
            padding: 'var(--space-2)',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            fontSize: 'var(--text-sm)',
            cursor: isConnected ? 'pointer' : 'not-allowed',
            opacity: isConnected ? 1 : 0.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-1)',
          }}
        >
          🎬 视频
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={!isConnected}
          style={{
            flex: 1,
            padding: 'var(--space-2)',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            fontSize: 'var(--text-sm)',
            cursor: isConnected ? 'pointer' : 'not-allowed',
            opacity: isConnected ? 1 : 0.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-1)',
          }}
        >
          📎 文件
        </button>
        {/* 隐藏的文件输入 */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleFileSelect(e, 'image')}
          style={{ display: 'none' }}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          multiple
          onChange={(e) => handleFileSelect(e, 'video')}
          style={{ display: 'none' }}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={(e) => handleFileSelect(e, 'file')}
          style={{ display: 'none' }}
        />
      </div>

      {/* 聊天记录 - 可滚动区域 */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <ChatView />
      </div>

      {/* 输入框 */}
      <div style={{ padding: 'var(--space-2) 0', flexShrink: 0 }}>
        <textarea
          ref={textareaRef}
          value={currentText}
          onChange={handleTextChange}
          placeholder={t('textPanel.placeholder')}
          className="message-input"
          rows={3}
          style={{
            width: '100%',
            minHeight: '80px',
            maxHeight: '150px',
          }}
        />
        <div
          style={{
            textAlign: 'right',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-tertiary)',
            marginTop: 'var(--space-1)',
          }}
        >
          {t('textPanel.charCount', { count: currentText.length })}
        </div>
      </div>

      {/* 上传进度条 */}
      {uploadingFiles.length > 0 && (
        <div style={{ marginBottom: 'var(--space-2)', flexShrink: 0 }}>
          {uploadingFiles.map(file => (
            <div
              key={file.id}
              style={{
                padding: 'var(--space-2)',
                background: 'var(--card)',
                borderRadius: 'var(--radius)',
                marginBottom: 'var(--space-1)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  {file.type === 'image' ? '🖼️' : file.type === 'video' ? '🎬' : '📎'} {file.filename}
                </span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--primary)' }}>{file.progress}%</span>
              </div>
              <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${file.progress}%`,
                    background: 'var(--primary)',
                    transition: 'width 0.2s',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}


      {/* Toast 容器 */}
      <ToastContainer />
    </div>
  );
}
