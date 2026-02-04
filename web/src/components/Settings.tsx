import { useAppStore } from '../stores/appStore';
import { Modal, Button } from './common';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: { maxConnections: number }) => void;
}

export function Settings({ isOpen, onClose, onSave }: SettingsProps) {
  const { settings, setSettings } = useAppStore();

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
      title="⚙️ 设置"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave}>保存</Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
            最大连接数
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => handleMaxConnectionsChange(settings.maxConnections - 1)}
              disabled={settings.maxConnections <= 1}
              style={{
                width: '40px',
                height: '40px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--card)',
                cursor: settings.maxConnections <= 1 ? 'not-allowed' : 'pointer',
                fontSize: '20px',
                opacity: settings.maxConnections <= 1 ? 0.5 : 1,
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
                borderRadius: 'var(--radius-sm)',
                fontSize: '18px',
                textAlign: 'center',
                outline: 'none',
              }}
            />
            <button
              onClick={() => handleMaxConnectionsChange(settings.maxConnections + 1)}
              disabled={settings.maxConnections >= 10}
              style={{
                width: '40px',
                height: '40px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--card)',
                cursor: settings.maxConnections >= 10 ? 'not-allowed' : 'pointer',
                fontSize: '20px',
                opacity: settings.maxConnections >= 10 ? 0.5 : 1,
              }}
            >
              +
            </button>
          </div>
          <p
            style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              marginTop: '8px',
            }}
          >
            限制同时连接的设备数量（1-10）
          </p>
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
            主题
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
                  background: settings.theme === theme ? 'var(--primary)' : 'var(--bg)',
                  color: settings.theme === theme ? 'white' : 'var(--text)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                {theme === 'light' && '☀️ 浅色'}
                {theme === 'dark' && '🌙 深色'}
                {theme === 'auto' && '🔄 跟随系统'}
              </button>
            ))}
          </div>
        </div>

        {/* 数据存储路径 */}
        <div>
          <label
            style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            数据存储
          </label>
          <div
            style={{
              padding: '12px',
              background: 'var(--bg)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              fontFamily: 'monospace',
              wordBreak: 'break-all',
            }}
          >
            ~/Documents/lan-bridge/
          </div>
          <p
            style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              marginTop: '8px',
            }}
          >
            文件、图片、视频和聊天记录的存储位置
          </p>
        </div>

        {/* 关于 */}
        <div
          style={{
            padding: '16px',
            background: 'var(--bg)',
            borderRadius: 'var(--radius)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🌉</div>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>LAN Bridge v2.0</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            内网桥接工具 - 文本同步 | 文件传输 | 剪贴板操作
          </div>
        </div>
      </div>
    </Modal>
  );
}
