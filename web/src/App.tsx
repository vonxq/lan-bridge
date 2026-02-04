import { useEffect, useState, useCallback } from 'react';
import { ServerPage } from './pages/ServerPage';
import { ClientPage } from './pages/ClientPage';
import { ScanPage } from './pages/ScanPage';

// 从 window 获取注入的 token
declare global {
  interface Window {
    AUTH_TOKEN?: string;
    SERVER_TOKEN?: string;
    IS_SERVER_VIEW?: boolean;
    IS_SERVER_LOGIN?: boolean;
  }
}

const TOKEN_STORAGE_KEY = 'lan-bridge-token';

function App() {
  const [viewMode, setViewMode] = useState<'loading' | 'server' | 'client' | 'scan'>('loading');
  const [authToken, setAuthToken] = useState<string>('');

  // 验证 token 是否有效
  const validateToken = useCallback(async (token: string): Promise<boolean> => {
    if (!token) return false;
    try {
      // 尝试通过 WebSocket 连接验证 token
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}?token=${token}`;
      
      return new Promise((resolve) => {
        const ws = new WebSocket(wsUrl);
        const timeout = setTimeout(() => {
          ws.close();
          resolve(false);
        }, 3000);
        
        ws.onopen = () => {
          clearTimeout(timeout);
          ws.close();
          resolve(true);
        };
        
        ws.onerror = () => {
          clearTimeout(timeout);
          resolve(false);
        };
        
        ws.onclose = (e) => {
          clearTimeout(timeout);
          // 4001 是未授权关闭码
          resolve(e.code !== 4001);
        };
      });
    } catch {
      return false;
    }
  }, []);

  // 保存 token 到 localStorage
  const saveToken = useCallback((token: string) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    setAuthToken(token);
    setViewMode('client');
  }, []);

  // 清除 token（token 过期时调用）
  const clearToken = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setAuthToken('');
    setViewMode('scan');
  }, []);

  // 主动重新扫码（已连接时也可以调用）
  const rescan = useCallback(() => {
    setViewMode('scan');
  }, []);

  useEffect(() => {
    const initApp = async () => {
      // 检查是否是服务端视图
      const serverToken = window.SERVER_TOKEN || '';
      const isServer = window.IS_SERVER_VIEW === true;
      const urlParams = new URLSearchParams(window.location.search);
      const urlServerToken = urlParams.get('server_token') || '';
      
      if (isServer || serverToken || urlServerToken) {
        setViewMode('server');
        return;
      }
      
      // 检查 URL 中是否有新的 token（从扫码获取）
      const urlClientToken = urlParams.get('token') || '';
      const injectedToken = window.AUTH_TOKEN || '';
      
      if (urlClientToken || injectedToken) {
        const token = urlClientToken || injectedToken;
        // 保存到 localStorage 并使用
        saveToken(token);
        // 清除 URL 中的 token 参数（保持 URL 干净）
        if (urlClientToken) {
          window.history.replaceState({}, '', window.location.pathname);
        }
        return;
      }
      
      // 检查 localStorage 中是否有保存的 token
      const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (savedToken) {
        // 验证 token 是否仍然有效
        const isValid = await validateToken(savedToken);
        if (isValid) {
          setAuthToken(savedToken);
          setViewMode('client');
          return;
        } else {
          // token 无效，清除并显示扫码页面
          localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
      }
      
      // 没有有效 token，显示扫码页面
      setViewMode('scan');
    };
    
    initApp();
  }, [saveToken, validateToken]);

  if (viewMode === 'loading') {
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

  if (viewMode === 'server') {
    return <ServerPage />;
  }

  if (viewMode === 'scan') {
    const isServerLogin = window.IS_SERVER_LOGIN === true;
    return <ScanPage onTokenReceived={saveToken} isServerLogin={isServerLogin} />;
  }

  return <ClientPage token={authToken} onTokenInvalid={clearToken} onRescan={rescan} />;
}

export default App;
