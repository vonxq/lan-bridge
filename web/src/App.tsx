import { useEffect, useState } from 'react';
import { QRCodePage } from './pages/QRCodePage';
import { ClientPage } from './pages/ClientPage';

// 从 window 获取注入的 token
declare global {
  interface Window {
    AUTH_TOKEN?: string;
    IS_SERVER_VIEW?: boolean;
  }
}

function App() {
  const [isServerView, setIsServerView] = useState<boolean | null>(null);
  const [authToken, setAuthToken] = useState<string>('');

  useEffect(() => {
    // 检查是否有注入的 token
    const token = window.AUTH_TOKEN || '';
    const isServer = window.IS_SERVER_VIEW === true;
    
    // 也可以从 URL 参数获取
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token') || '';
    
    setAuthToken(token || urlToken);
    setIsServerView(isServer || (!token && !urlToken));
  }, []);

  if (isServerView === null) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontSize: '18px',
        color: 'var(--text-secondary)'
      }}>
        加载中...
      </div>
    );
  }

  return isServerView ? <QRCodePage /> : <ClientPage token={authToken} />;
}

export default App;
