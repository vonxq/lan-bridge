import { useState } from 'react';
import { useTranslation } from '../i18n/I18nContext';

interface ScanPageProps {
  onTokenReceived: (token: string) => void;
  isServerLogin?: boolean;
}

export function ScanPage({ onTokenReceived, isServerLogin = false }: ScanPageProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const t = useTranslation();

  // 密码登录
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password.trim()) {
      setError('请输入密码');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          password: password.trim(),
          type: isServerLogin ? 'server' : 'client'
        }),
      });

      const data = await res.json();

      if (data.success) {
        if (isServerLogin && data.redirect) {
          // 服务端登录成功，跳转到服务端页面
          window.location.href = data.redirect;
        } else if (data.token) {
          // 客户端登录成功
          onTokenReceived(data.token);
        }
      } else {
        setError(data.error || '密码错误');
      }
    } catch {
      setError('连接失败，请检查网络');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-5)',
      }}
    >
      <div
        style={{
          background: 'var(--card)',
          borderRadius: 'var(--radius-2xl)',
          padding: 'var(--space-8)',
          textAlign: 'center',
          boxShadow: 'var(--shadow-xl)',
          maxWidth: '380px',
          width: '100%',
        }}
      >
        {/* Logo */}
        <div style={{ fontSize: '64px', marginBottom: 'var(--space-4)' }}>
          {isServerLogin ? '🖥️' : '🌉'}
        </div>
        
        {/* 标题 */}
        <h1
          style={{
            fontSize: 'var(--text-2xl)',
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: 'var(--space-2)',
          }}
        >
          {isServerLogin ? '服务端控制台' : 'LAN Bridge'}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)' }}>
          {isServerLogin ? '输入密码访问控制台' : t('app.subtitle')}
        </p>

        {/* 登录表单 */}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入连接密码"
              autoFocus
              style={{
                width: '100%',
                padding: 'var(--space-4)',
                border: `2px solid ${error ? 'var(--danger)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-lg)',
                fontSize: 'var(--text-base)',
                textAlign: 'center',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => {
                if (!error) {
                  e.target.style.borderColor = 'var(--primary)';
                }
              }}
              onBlur={(e) => {
                if (!error) {
                  e.target.style.borderColor = 'var(--border)';
                }
              }}
            />
          </div>

          {/* 错误提示 */}
          {error && (
            <div
              style={{
                padding: 'var(--space-3)',
                background: 'var(--danger-light)',
                borderRadius: 'var(--radius)',
                marginBottom: 'var(--space-4)',
                fontSize: 'var(--text-sm)',
                color: 'var(--danger)',
              }}
            >
              {error}
            </div>
          )}

          {/* 登录按钮 */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: 'var(--space-4)',
              background: loading ? 'var(--text-tertiary)' : 'var(--primary)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              fontSize: 'var(--text-base)',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {loading ? '连接中...' : '连接'}
          </button>
        </form>

        {/* 提示 */}
        <div
          style={{
            marginTop: 'var(--space-6)',
            padding: 'var(--space-3)',
            background: 'var(--bg)',
            borderRadius: 'var(--radius)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-tertiary)',
            textAlign: 'left',
          }}
        >
          <p style={{ marginBottom: 'var(--space-2)' }}>💡 <strong>提示</strong></p>
          <ul style={{ margin: 0, paddingLeft: 'var(--space-4)', lineHeight: 1.8 }}>
            {isServerLogin ? (
              <>
                <li>密码在首次启动服务时设置</li>
                <li>可通过 lan-bridge password 修改</li>
              </>
            ) : (
              <>
                <li>密码在电脑启动服务时设置</li>
                <li>确保手机和电脑在同一网络</li>
              </>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
