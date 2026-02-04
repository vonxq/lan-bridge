import { ReactNode, useState } from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: string;
  content: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
}

export function Tabs({ tabs, defaultTab, onChange }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  const activeContent = tabs.find((t) => t.id === activeTab)?.content;

  return (
    <div>
      {/* Tab 导航 */}
      <div
        style={{
          display: 'flex',
          background: 'var(--bg)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-1)',
          marginBottom: 'var(--space-4)',
          gap: 'var(--space-1)',
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              style={{
                flex: 1,
                padding: 'var(--space-3) var(--space-2)',
                border: 'none',
                background: isActive 
                  ? 'var(--card)' 
                  : 'transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                borderRadius: 'var(--radius)',
                fontSize: 'var(--text-sm)',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                transition: 'all var(--transition)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-1)',
                boxShadow: isActive ? 'var(--shadow)' : 'none',
                minHeight: '44px',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = 'var(--text)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.5)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              {tab.icon && <span style={{ fontSize: '16px' }}>{tab.icon}</span>}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
      
      {/* Tab 内容 */}
      <div 
        className="fade-in"
        style={{
          animation: 'slideUp var(--transition) ease',
        }}
      >
        {activeContent}
      </div>
    </div>
  );
}
