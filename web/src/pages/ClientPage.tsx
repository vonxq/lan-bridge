import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAppStore } from '../stores/appStore';
import { Tabs, ToastContainer } from '../components/common';
import { showToast } from '../components/common/Toast';
import {
  StatusBar,
  TextPanel,
  FilePanel,
  ChatPanel,
  ShortcutsPanel,
  ConnectionList,
  Settings,
} from '../components';
import type { Shortcut, ShortcutAction } from '../types';

interface ClientPageProps {
  token: string;
}

export function ClientPage({ token }: ClientPageProps) {
  const [showSettings, setShowSettings] = useState(false);
  const { aiReplyEnabled, setSettings } = useAppStore();

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
  } = useWebSocket({ token });

  // 初始加载文件列表
  useEffect(() => {
    getFiles();
  }, [getFiles]);

  // 执行快捷方法
  const executeShortcut = useCallback(async (shortcut: Shortcut) => {
    if (shortcut.type !== 'action' || !shortcut.actions) return;

    for (const action of shortcut.actions) {
      await executeAction(action);
    }
  }, [paste, submit, getClipboard]);

  const executeAction = async (action: ShortcutAction) => {
    switch (action.type) {
      case 'paste':
        paste(action.aiReply || false);
        break;
      case 'enter':
        submit(false);
        break;
      case 'wait':
        await new Promise((resolve) => setTimeout(resolve, action.delay || 50));
        break;
      case 'clear':
        useAppStore.getState().setCurrentText('');
        break;
      case 'clipboard':
        getClipboard();
        break;
    }
  };

  // 处理设置保存
  const handleSettingsSave = (settings: { maxConnections: number }) => {
    setSettings(settings);
    send({ type: 'settings_update', settings, timestamp: Date.now() });
    showToast('设置已保存', 'success');
  };

  // 处理踢出用户
  const handleKickUser = (userId: string) => {
    if (confirm('确定踢出该用户？')) {
      send({ type: 'kick_user', userId, timestamp: Date.now() });
    }
  };

  // 处理查看历史
  const handleViewHistory = (userId: string) => {
    useAppStore.getState().setSelectedUserId(userId);
    // 切换到聊天记录 tab
  };

  const tabs = [
    {
      id: 'text',
      label: '文本',
      icon: '📝',
      content: (
        <TextPanel
          onSync={syncText}
          onPaste={() => paste(aiReplyEnabled)}
          onReplace={replaceLine}
          onSubmit={() => submit(aiReplyEnabled)}
          onGetClipboard={getClipboard}
          onGetCurrentLine={getCurrentLine}
          onReconnect={connect}
        />
      ),
    },
    {
      id: 'shortcuts',
      label: '快捷',
      icon: '⚡',
      content: <ShortcutsPanel onExecute={executeShortcut} />,
    },
    {
      id: 'files',
      label: '文件',
      icon: '📁',
      content: (
        <FilePanel
          token={token}
          onRefresh={getFiles}
          onDelete={deleteFile}
        />
      ),
    },
    {
      id: 'chat',
      label: '记录',
      icon: '💬',
      content: <ChatPanel onClear={clearChat} />,
    },
    {
      id: 'connections',
      label: '连接',
      icon: '👥',
      content: (
        <ConnectionList
          onKickUser={handleKickUser}
          onViewHistory={handleViewHistory}
        />
      ),
    },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '16px',
        paddingBottom: 'env(safe-area-inset-bottom, 16px)',
      }}
    >
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        {/* 标题 */}
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <h1 style={{ fontSize: '24px', color: 'var(--primary)' }}>🌉 LAN Bridge</h1>
        </div>

        {/* 状态栏 */}
        <StatusBar onSettingsClick={() => setShowSettings(true)} />

        {/* Tab 内容 */}
        <Tabs tabs={tabs} defaultTab="text" />
      </div>

      {/* 设置模态框 */}
      <Settings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={handleSettingsSave}
      />

      {/* Toast 容器 */}
      <ToastContainer />
    </div>
  );
}
