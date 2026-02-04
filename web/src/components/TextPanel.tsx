import { useEffect, useRef } from 'react';
import { useAppStore } from '../stores/appStore';
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
    <div>
      {/* 输入区域 */}
      <div
        style={{
          background: 'var(--card)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px',
          marginBottom: '16px',
          boxShadow: 'var(--shadow)',
        }}
      >
        <textarea
          ref={textareaRef}
          value={currentText}
          onChange={handleTextChange}
          placeholder="在这里输入内容..."
          style={{
            width: '100%',
            minHeight: '120px',
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
          {currentText.length} 字
        </div>
      </div>

      {/* 工具栏 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '8px',
          marginBottom: '16px',
        }}
      >
        <ToolButton icon="📋" label="剪贴板" onClick={onGetClipboard} />
        <ToolButton icon="📥" label="当前行" onClick={onGetCurrentLine} />
        <ToolButton icon="🗑️" label="清空" onClick={handleClear} />
        <ToolButton icon="🔄" label="重连" onClick={onReconnect} />
      </div>

      {/* 操作按钮 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
        }}
      >
        <Button
          variant="secondary"
          size="lg"
          onClick={onPaste}
          disabled={!isConnected}
          fullWidth
        >
          📋 粘贴
        </Button>
        <Button
          variant="warning"
          size="lg"
          onClick={onReplace}
          disabled={!isConnected}
          fullWidth
        >
          🔄 替换
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={onSubmit}
          disabled={!isConnected}
          fullWidth
        >
          🚀 发送
        </Button>
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
