import { useEffect, useState } from 'react';
import { ServerPage } from './pages/ServerPage';
import { ClientPage } from './pages/ClientPage';

// 从 window 获取注入的 token
declare global {
  interface Window {
    AUTH_TOKEN?: string;
    SERVER_TOKEN?: string;
    IS_SERVER_VIEW?: boolean;
  }
}

function App() {
  const [isServerView, setIsServerView] = useState<boolean | null>(null);
  const [authToken, setAuthToken] = useState<string>('');

  useEffect(() => {
    // 检查是否有注入的 token
    const clientToken = window.AUTH_TOKEN || '';
    const serverToken = window.SERVER_TOKEN || '';
    const isServer = window.IS_SERVER_VIEW === true;
    
    // 也可以从 URL 参数获取
    const urlParams = new URLSearchParams(window.location.search);
    const urlClientToken = urlParams.get('token') || '';
    const urlServerToken = urlParams.get('server_token') || '';
    
    // 有服务端 token 或明确标记为服务端视图
    const hasServerToken = !!(serverToken || urlServerToken);
    
    setAuthToken(clientToken || urlClientToken);
    setIsServerView(isServer || hasServerToken);
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

  // 服务端显示完整管理界面，客户端显示操作界面
  return isServerView ? <ServerPage /> : <ClientPage token={authToken} />;
}

export default App;
