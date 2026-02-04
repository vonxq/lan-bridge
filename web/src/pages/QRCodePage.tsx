import { useState, useEffect } from 'react';

interface QRCodeData {
  qrcode: string;
  url: string;
  connections: number;
  maxConnections: number;
  users: Array<{
    id: string;
    name: string;
    avatar: string;
    isOnline: boolean;
  }>;
}

export function QRCodePage() {
  const [data, setData] = useState<QRCodeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchQRCode = async () => {
    try {
      const res = await fetch('/api/qrcode');
      if (!res.ok) throw new Error('获取二维码失败');
      const result = await res.json();
      setData(result);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    fetchQRCode();
    // 每 5 秒刷新
    const interval = setInterval(fetchQRCode, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '24px',
          padding: '40px',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          maxWidth: '450px',
          width: '100%',
        }}
      >
        <h1 style={{ fontSize: '28px', color: '#1a1a2e', marginBottom: '8px' }}>
          🌉 LAN Bridge
        </h1>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '30px' }}>
          内网桥接工具 - 扫码连接
        </p>

        {/* 二维码 */}
        <div
          style={{
            background: '#f8f9fa',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '24px',
          }}
        >
          {error ? (
            <div style={{ color: 'var(--danger)', padding: '40px' }}>{error}</div>
          ) : data?.qrcode ? (
            <img
              src={data.qrcode}
              alt="扫码连接"
              style={{ width: '240px', height: '240px', borderRadius: '8px' }}
            />
          ) : (
            <div style={{ padding: '100px 0', color: '#666' }}>加载中...</div>
          )}
        </div>

        {/* 状态 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 20px',
            background: '#e8f5e9',
            borderRadius: '12px',
            color: '#2e7d32',
            fontSize: '14px',
            marginBottom: '20px',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              background: '#4caf50',
              borderRadius: '50%',
              animation: 'pulse 2s infinite',
            }}
          />
          <span>服务运行中</span>
        </div>

        {/* 连接信息 */}
        <p style={{ fontSize: '13px', color: '#888', marginBottom: '16px' }}>
          当前连接数: {data?.connections ?? 0} / {data?.maxConnections ?? 3}
        </p>

        {/* 在线用户 */}
        {data?.users && data.users.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <p style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>
              在线用户
            </p>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              {data.users.map((user) => (
                <div
                  key={user.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    background: '#f0f4ff',
                    borderRadius: '20px',
                    fontSize: '13px',
                  }}
                >
                  <span>{user.avatar}</span>
                  <span>{user.name}</span>
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: user.isOnline ? '#4caf50' : '#ccc',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 提示 */}
        <div
          style={{
            padding: '16px',
            background: '#fff3e0',
            borderRadius: '12px',
            fontSize: '13px',
            color: '#e65100',
            marginBottom: '16px',
          }}
        >
          📱 使用手机浏览器扫描二维码连接
          <br />
          ⚠️ 请确保手机和电脑在同一网络
        </div>

        {/* 刷新按钮 */}
        <button
          onClick={fetchQRCode}
          style={{
            padding: '10px 24px',
            background: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
        >
          🔄 刷新二维码
        </button>
      </div>
    </div>
  );
}
