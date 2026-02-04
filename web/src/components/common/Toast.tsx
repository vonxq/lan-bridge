import { useEffect, useState } from 'react';

interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

let toastListeners: ((toast: ToastMessage) => void)[] = [];

export function showToast(message: string, type: ToastMessage['type'] = 'info') {
  const toast: ToastMessage = {
    id: Date.now().toString(),
    message,
    type,
  };
  toastListeners.forEach((listener) => listener(toast));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const listener = (toast: ToastMessage) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 2500);
    };
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener);
    };
  }, []);

  const typeStyles: Record<ToastMessage['type'], React.CSSProperties> = {
    success: { background: 'var(--success)' },
    error: { background: 'var(--danger)' },
    warning: { background: 'var(--warning)' },
    info: { background: 'rgba(0, 0, 0, 0.8)' },
  };

  const typeIcons: Record<ToastMessage['type'], string> = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: '💡',
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            ...typeStyles[toast.type],
            color: 'white',
            padding: '12px 24px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'fadeIn 0.2s ease',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          }}
        >
          <span>{typeIcons[toast.type]}</span>
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
