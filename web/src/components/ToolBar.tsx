import { useTranslation } from '../i18n/I18nContext';

interface ToolBarProps {
  onGetClipboard: () => void;
  onGetCurrentLine: () => void;
  onReconnect: () => void;
  onClear: () => void;
  onMore: () => void;
  disabled?: boolean;
}

export function ToolBar({
  onGetClipboard,
  onGetCurrentLine,
  onReconnect,
  onClear,
  onMore,
  disabled = false,
}: ToolBarProps) {
  const t = useTranslation();

  const tools = [
    { icon: '📋', label: t('textPanel.clipboard'), onClick: onGetClipboard },
    { icon: '📥', label: t('textPanel.currentLine'), onClick: onGetCurrentLine },
    { icon: '🔄', label: t('textPanel.reconnect'), onClick: onReconnect },
    { icon: '🗑️', label: t('textPanel.clear'), onClick: onClear },
    { icon: '⋯', label: t('common.more'), onClick: onMore },
  ];

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 'var(--space-2)',
        padding: 'var(--space-2) 0',
      }}
    >
      {tools.map((tool, index) => (
        <button
          key={index}
          onClick={tool.onClick}
          disabled={disabled && tool.icon !== '⋯'}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            padding: 'var(--space-2) var(--space-1)',
            background: 'var(--card)',
            border: 'none',
            borderRadius: 'var(--radius)',
            cursor: disabled && tool.icon !== '⋯' ? 'not-allowed' : 'pointer',
            opacity: disabled && tool.icon !== '⋯' ? 0.5 : 1,
            transition: 'all var(--transition)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <span style={{ fontSize: '20px' }}>{tool.icon}</span>
          <span
            style={{
              fontSize: '10px',
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
            }}
          >
            {tool.label}
          </span>
        </button>
      ))}
    </div>
  );
}
