import { useAppStore } from '../stores/appStore';
import { useI18n } from '../i18n/I18nContext';
import type { Locale } from '../i18n';
import { Modal, Button } from './common';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: { maxConnections: number }) => void;
}

export function Settings({ isOpen, onClose, onSave }: SettingsProps) {
  const { settings, setSettings } = useAppStore();
  const { t, locale, setLocale, localeNames } = useI18n();

  const handleMaxConnectionsChange = (value: number) => {
    if (value >= 1 && value <= 10) {
      setSettings({ maxConnections: value });
    }
  };

  const handleSave = () => {
    onSave({ maxConnections: settings.maxConnections });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`⚙️ ${t('settings.title')}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave}>{t('common.save')}</Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* 语言设置 */}
        <div>
          <label
            style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            🌐 {t('settings.language')}
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(Object.keys(localeNames) as Locale[]).map((loc) => (
              <button
                key={loc}
                onClick={() => setLocale(loc)}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: 'none',
                  background: locale === loc 
                    ? 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)' 
                    : 'var(--bg)',
                  color: locale === loc ? 'white' : 'var(--text)',
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: locale === loc ? 600 : 400,
                  transition: 'all var(--transition)',
                  boxShadow: locale === loc ? '0 4px 12px rgba(102, 126, 234, 0.3)' : 'none',
                }}
              >
                {localeNames[loc]}
              </button>
            ))}
          </div>
        </div>

        {/* 最大连接数 */}
        <div>
          <label
            style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            👥 {t('settings.maxConnections')}
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => handleMaxConnectionsChange(settings.maxConnections - 1)}
              disabled={settings.maxConnections <= 1}
              style={{
                width: '44px',
                height: '44px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                background: 'var(--card)',
                cursor: settings.maxConnections <= 1 ? 'not-allowed' : 'pointer',
                fontSize: '20px',
                opacity: settings.maxConnections <= 1 ? 0.5 : 1,
                transition: 'all var(--transition)',
              }}
            >
              -
            </button>
            <input
              type="number"
              value={settings.maxConnections}
              onChange={(e) => handleMaxConnectionsChange(parseInt(e.target.value) || 1)}
              min={1}
              max={10}
              style={{
                width: '80px',
                padding: '10px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                fontSize: '18px',
                textAlign: 'center',
                outline: 'none',
              }}
            />
            <button
              onClick={() => handleMaxConnectionsChange(settings.maxConnections + 1)}
              disabled={settings.maxConnections >= 10}
              style={{
                width: '44px',
                height: '44px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                background: 'var(--card)',
                cursor: settings.maxConnections >= 10 ? 'not-allowed' : 'pointer',
                fontSize: '20px',
                opacity: settings.maxConnections >= 10 ? 0.5 : 1,
                transition: 'all var(--transition)',
              }}
            >
              +
            </button>
          </div>
        </div>

        {/* 主题设置 */}
        <div>
          <label
            style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            🎨 {t('settings.theme')}
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['light', 'dark', 'auto'] as const).map((theme) => (
              <button
                key={theme}
                onClick={() => setSettings({ theme })}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: 'none',
                  background: settings.theme === theme 
                    ? 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)' 
                    : 'var(--bg)',
                  color: settings.theme === theme ? 'white' : 'var(--text)',
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: settings.theme === theme ? 600 : 400,
                  transition: 'all var(--transition)',
                  boxShadow: settings.theme === theme ? '0 4px 12px rgba(102, 126, 234, 0.3)' : 'none',
                }}
              >
                {theme === 'light' && `☀️ ${t('settings.themeLight')}`}
                {theme === 'dark' && `🌙 ${t('settings.themeDark')}`}
                {theme === 'auto' && `🔄 ${t('settings.themeAuto')}`}
              </button>
            ))}
          </div>
        </div>

        {/* 关于 */}
        <div
          style={{
            padding: '16px',
            background: 'var(--bg)',
            borderRadius: 'var(--radius-lg)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🌉</div>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>{t('app.title')} v2.0</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {t('app.subtitle')}
          </div>
        </div>
      </div>
    </Modal>
  );
}
