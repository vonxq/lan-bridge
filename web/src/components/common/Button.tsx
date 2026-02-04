import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'success' | 'ghost';
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
  onMouseEnter,
  onMouseLeave,
  ...props
}: ButtonProps) {
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-2)',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontWeight: 600,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled || loading ? 0.5 : 1,
    transition: 'all var(--transition)',
    width: fullWidth ? '100%' : 'auto',
    fontFamily: 'inherit',
    lineHeight: 1.4,
    boxShadow: 'var(--shadow-sm)',
    position: 'relative',
    overflow: 'hidden',
  };

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { 
      padding: 'var(--space-2) var(--space-3)', 
      fontSize: 'var(--text-sm)',
      minHeight: '32px',
    },
    md: { 
      padding: 'var(--space-3) var(--space-5)', 
      fontSize: 'var(--text-base)',
      minHeight: '44px',
    },
    lg: { 
      padding: 'var(--space-4) var(--space-6)', 
      fontSize: 'var(--text-lg)',
      minHeight: '52px',
    },
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
      color: 'var(--text-inverse)',
      boxShadow: '0 4px 14px rgba(102, 126, 234, 0.35)',
    },
    secondary: {
      background: 'var(--card)',
      color: 'var(--text)',
      border: '1px solid var(--border)',
      boxShadow: 'var(--shadow)',
    },
    danger: {
      background: 'linear-gradient(135deg, var(--danger) 0%, #dc2626 100%)',
      color: 'var(--text-inverse)',
      boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)',
    },
    warning: {
      background: 'linear-gradient(135deg, var(--warning) 0%, #d97706 100%)',
      color: 'var(--text-inverse)',
      boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
    },
    success: {
      background: 'linear-gradient(135deg, var(--success) 0%, #059669 100%)',
      color: 'var(--text-inverse)',
      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-secondary)',
      boxShadow: 'none',
    },
  };

  const hoverStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: 'linear-gradient(135deg, var(--primary-hover) 0%, var(--primary-active) 100%)',
      transform: 'translateY(-1px)',
      boxShadow: '0 6px 20px rgba(102, 126, 234, 0.45)',
    },
    secondary: {
      background: 'var(--card-hover)',
      borderColor: 'var(--text-tertiary)',
    },
    danger: {
      transform: 'translateY(-1px)',
      boxShadow: '0 6px 20px rgba(239, 68, 68, 0.45)',
    },
    warning: {
      transform: 'translateY(-1px)',
      boxShadow: '0 6px 20px rgba(245, 158, 11, 0.45)',
    },
    success: {
      transform: 'translateY(-1px)',
      boxShadow: '0 6px 20px rgba(16, 185, 129, 0.45)',
    },
    ghost: {
      background: 'var(--bg-secondary)',
      color: 'var(--text)',
    },
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled && !loading) {
      const hover = hoverStyles[variant];
      Object.assign(e.currentTarget.style, hover);
    }
    onMouseEnter?.(e);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled && !loading) {
      const original = variantStyles[variant];
      Object.assign(e.currentTarget.style, original);
      e.currentTarget.style.transform = 'translateY(0)';
    }
    onMouseLeave?.(e);
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
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {loading ? (
        <span style={{ 
          animation: 'spin 1s linear infinite',
          display: 'inline-block',
        }}>
          ⏳
        </span>
      ) : icon}
      {children}
    </button>
  );
}
