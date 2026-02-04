import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAppStore } from '../stores/appStore';
import { useTranslation } from '../i18n/I18nContext';
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
    showToast(t('settings.saveSuccess'), 'success');
  };

  // 处理踢出用户
  const handleKickUser = (userId: string) => {
    if (confirm(t('connectionList.kickConfirm'))) {
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
      label: t('tabs.text'),
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
      label: t('tabs.shortcuts'),
      icon: '⚡',
      content: <ShortcutsPanel onExecute={executeShortcut} />,
    },
    {
      id: 'files',
      label: t('tabs.files'),
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
      label: t('tabs.chat'),
      icon: '💬',
      content: <ChatPanel onClear={clearChat} />,
    },
    {
      id: 'connections',
      label: t('tabs.connections'),
      icon: '👥',
      content: (
        <ConnectionList
          onKickUser={handleKickUser}
          onViewHistory={handleViewHistory}
        />
      ),
    },
  ];

  // 处理在 Finder 中打开文件
  const handleOpenInFinder = async (filename: string, category: string) => {
    try {
      const res = await fetch('/api/open-in-finder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, category }),
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || '打开失败', 'error');
      }
    } catch (e) {
      showToast('打开失败', 'error');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, var(--bg) 0%, var(--bg-secondary) 100%)',
        padding: 'var(--space-4)',
        paddingTop: 'max(var(--space-4), env(safe-area-inset-top))',
        paddingBottom: 'max(var(--space-4), env(safe-area-inset-bottom))',
      }}
    >
      <div 
        style={{ 
          maxWidth: '500px', 
          margin: '0 auto',
          animation: 'fadeIn var(--transition-slow) ease',
        }}
      >
        {/* 标题卡片 */}
        <div 
          style={{ 
            textAlign: 'center', 
            marginBottom: 'var(--space-4)',
            padding: 'var(--space-4)',
            background: 'var(--card)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-soft)',
          }}
        >
          <h1 
            style={{ 
              fontSize: 'var(--text-2xl)', 
              fontWeight: 700,
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              marginBottom: 'var(--space-1)',
            }}
          >
            🌉 {t('app.title')}
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            {t('app.subtitle')}
          </p>
        </div>

        {/* 状态栏 */}
        <StatusBar onSettingsClick={() => setShowSettings(true)} />

        {/* Tab 内容 */}
        <div
          style={{
            background: 'var(--card)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-soft)',
            padding: 'var(--space-4)',
            marginTop: 'var(--space-4)',
          }}
        >
          <Tabs 
            tabs={tabs.map(t => 
              t.id === 'chat' 
                ? { ...t, content: <ChatPanel onClear={clearChat} onOpenInFinder={handleOpenInFinder} /> }
                : t
            )} 
            defaultTab="text" 
          />
        </div>
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
