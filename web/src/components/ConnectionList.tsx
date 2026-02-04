import { useAppStore } from '../stores/appStore';
import { Button } from './common';
import type { User } from '../types';

interface ConnectionListProps {
  onKickUser?: (userId: string) => void;
  onViewHistory?: (userId: string) => void;
}

export function ConnectionList({ onKickUser, onViewHistory }: ConnectionListProps) {
  const { users, settings, currentUser } = useAppStore();

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('zh-CN');
  };

  const getTimeSince = (isoString: string) => {
    const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (seconds < 60) return `${seconds}秒前`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}分钟前`;
    const hours = Math.floor(minutes / 60);
    return `${hours}小时前`;
  };

  return (
    <div
      style={{
        background: 'var(--card)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow)',
        overflow: 'hidden',
      }}
    >
      {/* 头部 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid var(--bg)',
        }}
      >
        <span style={{ fontSize: '14px', fontWeight: 600 }}>👥 连接列表</span>
        <span
          style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            padding: '2px 8px',
            background: 'var(--bg)',
            borderRadius: '10px',
          }}
        >
          {users.length} / {settings.maxConnections}
        </span>
      </div>

      {/* 用户列表 */}
      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {users.length === 0 ? (
          <div
            style={{
              padding: '32px',
              textAlign: 'center',
              color: 'var(--text-secondary)',
            }}
          >
            暂无连接
          </div>
        ) : (
          users.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              isCurrentUser={user.id === currentUser?.id}
              onKick={onKickUser}
              onViewHistory={onViewHistory}
              formatTime={formatTime}
              getTimeSince={getTimeSince}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface UserCardProps {
  user: User;
  isCurrentUser: boolean;
  onKick?: (userId: string) => void;
  onViewHistory?: (userId: string) => void;
  formatTime: (time: string) => string;
  getTimeSince: (time: string) => string;
}

function UserCard({
  user,
  isCurrentUser,
  onKick,
  onViewHistory,
  getTimeSince,
}: UserCardProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        borderBottom: '1px solid var(--bg)',
        background: isCurrentUser ? '#f0f4ff' : 'transparent',
      }}
    >
      {/* 头像 */}
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: 'var(--bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          flexShrink: 0,
        }}
      >
        {user.avatar}
      </div>

      {/* 信息 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '14px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {user.name}
          </span>
          {isCurrentUser && (
            <span
              style={{
                fontSize: '10px',
                padding: '2px 6px',
                background: 'var(--primary)',
                color: 'white',
                borderRadius: '8px',
              }}
            >
              我
            </span>
          )}
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: user.isOnline ? 'var(--success)' : 'var(--text-secondary)',
            }}
          />
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
          {user.isOnline ? `活跃于 ${getTimeSince(user.lastActiveAt)}` : '离线'}
        </div>
      </div>

      {/* 操作 */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {onViewHistory && (
          <Button size="sm" variant="ghost" onClick={() => onViewHistory(user.id)}>
            📜
          </Button>
        )}
        {onKick && !isCurrentUser && (
          <Button size="sm" variant="danger" onClick={() => onKick(user.id)}>
            踢出
          </Button>
        )}
      </div>
    </div>
  );
}
