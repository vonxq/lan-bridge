import { useTranslation } from '../i18n/I18nContext';

interface ActionBarProps {
  onPaste: () => void;
  onReplace: () => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export function ActionBar({ onPaste, onReplace, onSubmit, disabled = false }: ActionBarProps) {
  const t = useTranslation();

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 'var(--space-3)',
        padding: 'var(--space-2) 0',
      }}
    >
      {/* 粘贴按钮 */}
      <button
        onClick={onPaste}
        disabled={disabled}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-4)',
          background: 'var(--secondary)',
          color: 'white',
          border: 'none',
          borderRadius: 'var(--radius-lg)',
          fontSize: 'var(--text-base)',
          fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          transition: 'all var(--transition)',
          boxShadow: 'var(--shadow)',
        }}
      >
        <span>📋</span>
        <span>{t('textPanel.paste')}</span>
      </button>

      {/* 替换按钮 */}
      <button
        onClick={onReplace}
        disabled={disabled}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-4)',
          background: 'var(--warning)',
          color: 'white',
          border: 'none',
          borderRadius: 'var(--radius-lg)',
          fontSize: 'var(--text-base)',
          fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          transition: 'all var(--transition)',
          boxShadow: 'var(--shadow)',
        }}
      >
        <span>🔄</span>
        <span>{t('textPanel.replace')}</span>
      </button>

      {/* 发送按钮 */}
      <button
        onClick={onSubmit}
        disabled={disabled}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-4)',
          background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
          color: 'white',
          border: 'none',
          borderRadius: 'var(--radius-lg)',
          fontSize: 'var(--text-base)',
          fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          transition: 'all var(--transition)',
          boxShadow: 'var(--shadow)',
        }}
      >
        <span>🚀</span>
        <span>{t('textPanel.submit')}</span>
      </button>
    </div>
  );
}
