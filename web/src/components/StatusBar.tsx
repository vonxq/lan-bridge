import { useAppStore } from '../stores/appStore';

interface StatusBarProps {
  onSettingsClick?: () => void;
}

export function StatusBar({ onSettingsClick }: StatusBarProps) {
  const { connectionStatus, aiReplyEnabled, setAiReplyEnabled, users, currentUser } = useAppStore();

  const statusConfig = {
    connecting: { color: 'var(--warning)', text: '连接中...', shadow: '0 0 8px rgba(245, 158, 11, 0.5)' },
    connected: { color: 'var(--success)', text: '已连接', shadow: '0 0 8px rgba(16, 185, 129, 0.5)' },
    disconnected: { color: 'var(--danger)', text: '未连接', shadow: '0 0 8px rgba(239, 68, 68, 0.5)' },
    error: { color: 'var(--danger)', text: '连接错误', shadow: '0 0 8px rgba(239, 68, 68, 0.5)' },
  };

  const { color, text, shadow } = statusConfig[connectionStatus];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--space-3) var(--space-4)',
        background: 'var(--card)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-soft)',
        flexWrap: 'wrap',
        gap: 'var(--space-3)',
      }}
    >
      {/* 左侧：连接状态 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: 'var(--radius-full)',
              background: color,
              boxShadow: shadow,
              animation: connectionStatus === 'connected' ? 'pulse 2s infinite' : 'none',
            }}
          />
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 500 }}>
            {text}
          </span>
        </div>

        {/* 当前用户信息 */}
        {currentUser && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-1) var(--space-3)',
              background: 'var(--primary-light)',
              borderRadius: 'var(--radius-full)',
              fontSize: 'var(--text-sm)',
            }}
          >
            <span>{currentUser.avatar}</span>
            <span style={{ fontWeight: 500, color: 'var(--primary)' }}>{currentUser.name}</span>
          </div>
        )}

        {/* 在线用户数 */}
        {users.length > 0 && (
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-secondary)',
              padding: 'var(--space-1) var(--space-2)',
              background: 'var(--bg)',
              borderRadius: 'var(--radius-full)',
              fontWeight: 500,
            }}
          >
            👥 {users.length} 在线
          </span>
        )}
      </div>

      {/* 右侧：AI回复开关和设置 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        {/* AI 回复开关 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>🤖</label>
          <label
            style={{
              position: 'relative',
              width: '44px',
              height: '24px',
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
                background: aiReplyEnabled 
                  ? 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)' 
                  : 'var(--border)',
                borderRadius: 'var(--radius-full)',
                transition: 'all var(--transition)',
                boxShadow: aiReplyEnabled ? '0 2px 8px rgba(102, 126, 234, 0.4)' : 'none',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  height: '18px',
                  width: '18px',
                  left: aiReplyEnabled ? '23px' : '3px',
                  bottom: '3px',
                  background: 'white',
                  borderRadius: 'var(--radius-full)',
                  transition: 'all var(--transition)',
                  boxShadow: 'var(--shadow-sm)',
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
              background: 'var(--bg)',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              padding: 'var(--space-2)',
              borderRadius: 'var(--radius)',
              transition: 'all var(--transition)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-secondary)';
              e.currentTarget.style.transform = 'rotate(45deg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg)';
              e.currentTarget.style.transform = 'rotate(0deg)';
            }}
          >
            ⚙️
          </button>
        )}
      </div>
    </div>
  );
}
