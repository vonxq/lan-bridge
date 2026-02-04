import { useState, useCallback } from 'react';
import { useAppStore } from '../stores/appStore';
import { useTranslation } from '../i18n/I18nContext';
import { ToastContainer } from '../components/common';
import { showToast } from '../components/common/Toast';
import { FilePanel } from '../components/FilePanel';
import { ShortcutsPanel } from '../components/ShortcutsPanel';
import { ConnectionList } from '../components/ConnectionList';
import type { Shortcut, ShortcutAction, WSMessage } from '../types';

interface OthersPageProps {
  token: string;
  onBack: () => void;
  onClearChat: () => void;
  onDeleteFile: (filename: string, category: string) => void;
  onRefreshFiles: () => void;
  send: (message: WSMessage) => void;
}

type ActiveSection = 'menu' | 'files' | 'shortcuts' | 'connections' | 'settings';

export function OthersPage({
  token,
  onBack,
  onClearChat,
  onDeleteFile,
  onRefreshFiles,
  send,
}: OthersPageProps) {
  const [activeSection, setActiveSection] = useState<ActiveSection>('menu');
  const { setSettings } = useAppStore();
  const t = useTranslation();

  const menuItems = [
    { id: 'files' as const, icon: '📁', label: t('tabs.files'), desc: '管理上传的文件' },
    { id: 'shortcuts' as const, icon: '⚡', label: t('tabs.shortcuts'), desc: '快捷操作和模板' },
    { id: 'connections' as const, icon: '👥', label: t('tabs.connections'), desc: '查看连接用户' },
    { id: 'settings' as const, icon: '⚙️', label: t('common.settings'), desc: '应用设置' },
  ];

  // 执行快捷方法
  const executeShortcut = useCallback((shortcut: Shortcut) => {
    if (shortcut.type !== 'action' || !shortcut.actions) return;

    const executeAction = async (action: ShortcutAction) => {
      switch (action.type) {
        case 'paste':
          // 发送粘贴命令
          send({ type: 'paste_only', needAiReply: action.aiReply || false, timestamp: Date.now() });
          break;
        case 'enter':
          send({ type: 'submit', needAiReply: false, timestamp: Date.now() });
          break;
        case 'wait':
          await new Promise((resolve) => setTimeout(resolve, action.delay || 50));
          break;
        case 'clear':
          useAppStore.getState().setCurrentText('');
          break;
        case 'clipboard':
          send({ type: 'get_clipboard', timestamp: Date.now() });
          break;
      }
    };

    (async () => {
      for (const action of shortcut.actions!) {
        await executeAction(action);
      }
    })();
  }, [send]);

  // 踢出用户
  const handleKickUser = (userId: string) => {
    if (confirm(t('connectionList.kickConfirm'))) {
      send({ type: 'kick_user', userId, timestamp: Date.now() });
    }
  };

  // 保存设置
  const handleSettingsSave = (settings: { maxConnections: number }) => {
    setSettings(settings);
    send({ type: 'settings_update', settings, timestamp: Date.now() });
    showToast(t('settings.saveSuccess'), 'success');
  };

  // 渲染内容
  const renderContent = () => {
    switch (activeSection) {
      case 'files':
        return (
          <FilePanel
            token={token}
            onRefresh={onRefreshFiles}
            onDelete={onDeleteFile}
          />
        );
      case 'shortcuts':
        return <ShortcutsPanel onExecute={executeShortcut} />;
      case 'connections':
        return (
          <ConnectionList
            onKickUser={handleKickUser}
          />
        );
      case 'settings':
        return (
          <div>
            <div
              style={{
                background: 'var(--card)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-4)',
                marginBottom: 'var(--space-3)',
              }}
            >
              <h3 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-3)' }}>
                基本设置
              </h3>
              <SettingsInline onSave={handleSettingsSave} />
            </div>
            <div
              style={{
                background: 'var(--card)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-4)',
              }}
            >
              <h3 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-3)' }}>
                数据管理
              </h3>
              <button
                onClick={() => {
                  if (confirm(t('chatPanel.clearConfirm'))) {
                    onClearChat();
                    showToast('已清空聊天记录', 'success');
                  }
                }}
                style={{
                  width: '100%',
                  padding: 'var(--space-3)',
                  background: 'var(--danger-light)',
                  color: 'var(--danger)',
                  border: 'none',
                  borderRadius: 'var(--radius)',
                  fontSize: 'var(--text-sm)',
                  cursor: 'pointer',
                }}
              >
                🗑️ 清空聊天记录
              </button>
            </div>
          </div>
        );
      default:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {menuItems.map((item) => (
              <button
                key={item.id}
                className="menu-item"
                onClick={() => setActiveSection(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-4)',
                  padding: 'var(--space-4)',
                  background: 'var(--card)',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-sm)',
                  cursor: 'pointer',
                  transition: 'all var(--transition)',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <span style={{ fontSize: '28px' }}>{item.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--text-base)', fontWeight: 500 }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    {item.desc}
                  </div>
                </div>
                <span style={{ color: 'var(--text-tertiary)' }}>›</span>
              </button>
            ))}
          </div>
        );
    }
  };

  const getSectionTitle = () => {
    switch (activeSection) {
      case 'files':
        return t('tabs.files');
      case 'shortcuts':
        return t('tabs.shortcuts');
      case 'connections':
        return t('tabs.connections');
      case 'settings':
        return t('common.settings');
      default:
        return t('common.more');
    }
  };

  return (
    <div className="others-page">
      {/* 顶部导航 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-4)',
        }}
      >
        <button
          onClick={() => {
            if (activeSection === 'menu') {
              onBack();
            } else {
              setActiveSection('menu');
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-3)',
            background: 'var(--card)',
            border: 'none',
            borderRadius: 'var(--radius)',
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <span>←</span>
          <span>{activeSection === 'menu' ? t('common.back') : t('common.more')}</span>
        </button>
        <h2
          style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 600,
            color: 'var(--text)',
          }}
        >
          {getSectionTitle()}
        </h2>
      </div>

      {/* 内容区域 */}
      {renderContent()}

      <ToastContainer />
    </div>
  );
}

// 内联设置组件
function SettingsInline({ onSave }: { onSave: (settings: { maxConnections: number }) => void }) {
  const { settings, aiReplyEnabled, setAiReplyEnabled } = useAppStore();
  const [maxConnections, setMaxConnections] = useState(settings.maxConnections);

  const handleSave = () => {
    onSave({ maxConnections });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* 最大连接数 */}
      <div>
        <label
          style={{
            display: 'block',
            fontSize: 'var(--text-sm)',
            marginBottom: 'var(--space-2)',
          }}
        >
          最大连接数
        </label>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <input
            type="number"
            min={1}
            max={10}
            value={maxConnections}
            onChange={(e) => setMaxConnections(parseInt(e.target.value) || 3)}
            style={{
              flex: 1,
              padding: 'var(--space-2) var(--space-3)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--text-sm)',
            }}
          />
          <button
            onClick={handleSave}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              background: 'var(--primary)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--text-sm)',
              cursor: 'pointer',
            }}
          >
            保存
          </button>
        </div>
      </div>

      {/* AI 回复开关 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: 'var(--text-sm)' }}>AI 回复模式</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            发送后自动请求 AI 回复摘要
          </div>
        </div>
        <button
          onClick={() => setAiReplyEnabled(!aiReplyEnabled)}
          style={{
            width: '50px',
            height: '28px',
            borderRadius: '14px',
            border: 'none',
            background: aiReplyEnabled ? 'var(--primary)' : 'var(--border)',
            cursor: 'pointer',
            position: 'relative',
            transition: 'all var(--transition)',
          }}
        >
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: 'white',
              position: 'absolute',
              top: '2px',
              left: aiReplyEnabled ? '24px' : '2px',
              transition: 'all var(--transition)',
              boxShadow: 'var(--shadow-sm)',
            }}
          />
        </button>
      </div>
    </div>
  );
}
