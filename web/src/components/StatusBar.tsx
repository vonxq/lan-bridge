import { useAppStore } from '../stores/appStore';

interface StatusBarProps {
  onSettingsClick?: () => void;
}

export function StatusBar({ onSettingsClick }: StatusBarProps) {
  const { connectionStatus, aiReplyEnabled, setAiReplyEnabled, users, currentUser } = useAppStore();

  const statusConfig = {
    connecting: { color: 'var(--warning)', text: '连接中...' },
    connected: { color: 'var(--success)', text: '已连接' },
    disconnected: { color: 'var(--danger)', text: '未连接' },
    error: { color: 'var(--danger)', text: '连接错误' },
  };

  const { color, text } = statusConfig[connectionStatus];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'var(--card)',
        borderRadius: 'var(--radius)',
        marginBottom: '16px',
        boxShadow: 'var(--shadow)',
      }}
    >
      {/* 左侧：连接状态 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: color,
              animation: connectionStatus === 'connected' ? 'pulse 2s infinite' : 'none',
            }}
          />
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{text}</span>
        </div>

        {/* 当前用户信息 */}
        {currentUser && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              background: 'var(--bg)',
              borderRadius: '20px',
              fontSize: '13px',
            }}
          >
            <span>{currentUser.avatar}</span>
            <span>{currentUser.name}</span>
          </div>
        )}

        {/* 在线用户数 */}
        {users.length > 0 && (
          <span
            style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              padding: '2px 8px',
              background: 'var(--bg)',
              borderRadius: '10px',
            }}
          >
            {users.length} 人在线
          </span>
        )}
      </div>

      {/* 右侧：AI回复开关和设置 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* AI 回复开关 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>🤖 AI回复</label>
          <label
            style={{
              position: 'relative',
              width: '50px',
              height: '28px',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={aiReplyEnabled}
              onChange={(e) => setAiReplyEnabled(e.target.checked)}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span
              style={{
                position: 'absolute',
                cursor: 'pointer',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: aiReplyEnabled ? 'var(--primary)' : 'var(--border)',
                borderRadius: '28px',
                transition: '0.3s',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  content: '""',
                  height: '22px',
                  width: '22px',
                  left: aiReplyEnabled ? '25px' : '3px',
                  bottom: '3px',
                  background: 'white',
                  borderRadius: '50%',
                  transition: '0.3s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }}
              />
            </span>
          </label>
        </div>

        {/* 设置按钮 */}
        {onSettingsClick && (
          <button
            onClick={onSettingsClick}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            ⚙️
          </button>
        )}
      </div>
    </div>
  );
}
