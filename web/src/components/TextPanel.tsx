import { useEffect, useRef } from 'react';
import { useAppStore } from '../stores/appStore';
import { useTranslation } from '../i18n/I18nContext';
import { Button } from './common';

interface TextPanelProps {
  onSync: (text: string) => void;
  onPaste: () => void;
  onReplace: () => void;
  onSubmit: () => void;
  onGetClipboard: () => void;
  onGetCurrentLine: () => void;
  onReconnect: () => void;
}

export function TextPanel({
  onSync,
  onPaste,
  onReplace,
  onSubmit,
  onGetClipboard,
  onGetCurrentLine,
  onReconnect,
}: TextPanelProps) {
  const { currentText, setCurrentText, connectionStatus } = useAppStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const t = useTranslation();

  const isConnected = connectionStatus === 'connected';

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setCurrentText(text);
    onSync(text);
  };

  const handleClear = () => {
    setCurrentText('');
    onSync('');
  };

  // 自动聚焦
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 工具栏 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '8px',
          marginBottom: '12px',
          flexShrink: 0,
        }}
      >
        <ToolButton icon="📋" label={t('textPanel.clipboard')} onClick={onGetClipboard} />
        <ToolButton icon="📥" label={t('textPanel.currentLine')} onClick={onGetCurrentLine} />
        <ToolButton icon="🗑️" label={t('textPanel.clear')} onClick={handleClear} />
        <ToolButton icon="🔄" label={t('textPanel.reconnect')} onClick={onReconnect} />
      </div>
      {/* 操作按钮 - 移到最上方，键盘弹出时不会被遮挡 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          marginBottom: '12px',
          flexShrink: 0,
        }}
      >
        <Button
          variant="secondary"
          size="lg"
          onClick={onPaste}
          disabled={!isConnected}
          fullWidth
        >
          📋 {t('textPanel.paste')}
        </Button>
        <Button
          variant="warning"
          size="lg"
          onClick={onReplace}
          disabled={!isConnected}
          fullWidth
        >
          🔄 {t('textPanel.replace')}
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={onSubmit}
          disabled={!isConnected}
          fullWidth
        >
          🚀 {t('textPanel.submit')}
        </Button>
      </div>

      {/* 输入区域 - 放在底部，键盘弹出时可以滚动 */}
      <div
        style={{
          background: 'var(--card)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px',
          boxShadow: 'var(--shadow)',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <textarea
          ref={textareaRef}
          value={currentText}
          onChange={handleTextChange}
          placeholder={t('textPanel.placeholder')}
          style={{
            width: '100%',
            flex: 1,
            minHeight: '100px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '12px',
            fontSize: '16px',
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--primary)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
        />
        <div
          style={{
            textAlign: 'right',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            marginTop: '8px',
          }}
        >
          {t('textPanel.charCount', { count: currentText.length })}
        </div>
      </div>
    </div>
  );
}

function ToolButton({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        padding: '12px 8px',
        background: 'var(--card)',
        border: 'none',
        borderRadius: 'var(--radius)',
        cursor: 'pointer',
        transition: 'all 0.2s',
        boxShadow: 'var(--shadow)',
      }}
    >
      <span style={{ fontSize: '24px' }}>{icon}</span>
      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{label}</span>
    </button>
  );
}
