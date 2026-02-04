import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  fullWidth,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontWeight: 600,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled || loading ? 0.5 : 1,
    transition: 'all 0.2s',
    width: fullWidth ? '100%' : 'auto',
  };

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { padding: '6px 12px', fontSize: '12px' },
    md: { padding: '10px 16px', fontSize: '14px' },
    lg: { padding: '14px 24px', fontSize: '16px' },
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: 'var(--primary)',
      color: 'white',
    },
    secondary: {
      background: 'var(--card)',
      color: 'var(--text)',
      border: '1px solid var(--border)',
    },
    danger: {
      background: 'var(--danger)',
      color: 'white',
    },
    warning: {
      background: 'var(--warning)',
      color: 'white',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-secondary)',
    },
  };

  return (
    <button
      style={{
        ...baseStyle,
        ...sizeStyles[size],
        ...variantStyles[variant],
        ...style,
      }}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
      ) : icon}
      {children}
    </button>
  );
}
