import { useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { Button, Modal } from './common';
import type { Shortcut, ShortcutAction } from '../types';

interface ShortcutsPanelProps {
  onExecute: (shortcut: Shortcut) => void;
}

export function ShortcutsPanel({ onExecute }: ShortcutsPanelProps) {
  const { shortcuts, setCurrentText, currentText, addShortcut, updateShortcut, removeShortcut } = useAppStore();
  const [editingShortcut, setEditingShortcut] = useState<Shortcut | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleExecute = (shortcut: Shortcut) => {
    if (shortcut.type === 'template') {
      setCurrentText((shortcut.template || '') + currentText);
    } else {
      onExecute(shortcut);
    }
  };

  const handleSave = (shortcut: Shortcut) => {
    if (isCreating) {
      addShortcut(shortcut);
    } else {
      updateShortcut(shortcut.id, shortcut);
    }
    setEditingShortcut(null);
    setIsCreating(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('确定删除这个快捷方法？')) {
      removeShortcut(id);
    }
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingShortcut({
      id: `custom-${Date.now()}`,
      name: '',
      type: 'template',
      template: '',
      isBuiltin: false,
      order: shortcuts.length + 1,
    });
  };

  const getShortcutIcon = (type: Shortcut['type']) => {
    switch (type) {
      case 'template':
        return '📝';
      case 'action':
        return '⚡';
      case 'keyboard':
        return '⌨️';
      default:
        return '📌';
    }
  };

  const sortedShortcuts = [...shortcuts].sort((a, b) => a.order - b.order);

  return (
    <div>
      {/* 快捷方法网格 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        {sortedShortcuts.map((shortcut) => (
          <div
            key={shortcut.id}
            onClick={() => handleExecute(shortcut)}
            style={{
              background: 'var(--card)',
              borderRadius: 'var(--radius)',
              padding: '16px 12px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: 'var(--shadow)',
              position: 'relative',
            }}
          >
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>
              {getShortcutIcon(shortcut.type)}
            </div>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {shortcut.name}
            </div>
            <div
              style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                marginTop: '4px',
              }}
            >
              {shortcut.type === 'template' && '模板'}
              {shortcut.type === 'action' && '操作'}
              {shortcut.type === 'keyboard' && shortcut.keyboard && (
                <>
                  {shortcut.keyboard.modifiers.map((m) => m.toUpperCase()).join('+')}
                  {shortcut.keyboard.modifiers.length > 0 && '+'}
                  {shortcut.keyboard.key.toUpperCase()}
                </>
              )}
            </div>
            {/* 编辑按钮 */}
            {!shortcut.isBuiltin && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingShortcut(shortcut);
                  setIsCreating(false);
                }}
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  opacity: 0.5,
                }}
              >
                ✏️
              </button>
            )}
          </div>
        ))}

        {/* 添加按钮 */}
        <div
          onClick={handleCreate}
          style={{
            background: 'var(--bg)',
            borderRadius: 'var(--radius)',
            padding: '16px 12px',
            textAlign: 'center',
            cursor: 'pointer',
            border: '2px dashed var(--border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100px',
          }}
        >
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>➕</div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>添加</div>
        </div>
      </div>

      {/* 编辑模态框 */}
      <ShortcutEditor
        isOpen={!!editingShortcut}
        shortcut={editingShortcut}
        isCreating={isCreating}
        onSave={handleSave}
        onDelete={handleDelete}
        onClose={() => {
          setEditingShortcut(null);
          setIsCreating(false);
        }}
      />
    </div>
  );
}

interface ShortcutEditorProps {
  isOpen: boolean;
  shortcut: Shortcut | null;
  isCreating: boolean;
  onSave: (shortcut: Shortcut) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function ShortcutEditor({
  isOpen,
  shortcut,
  isCreating,
  onSave,
  onDelete,
  onClose,
}: ShortcutEditorProps) {
  const [name, setName] = useState(shortcut?.name || '');
  const [type, setType] = useState<Shortcut['type']>(shortcut?.type || 'template');
  const [template, setTemplate] = useState(shortcut?.template || '');
  const [actions, setActions] = useState<ShortcutAction[]>(shortcut?.actions || []);

  // 同步 shortcut 变化
  if (shortcut && name !== shortcut.name && !isCreating) {
    setName(shortcut.name);
    setType(shortcut.type);
    setTemplate(shortcut.template || '');
    setActions(shortcut.actions || []);
  }

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      ...shortcut!,
      name,
      type,
      template: type === 'template' ? template : undefined,
      actions: type === 'action' ? actions : undefined,
    });
  };

  const addAction = () => {
    setActions([...actions, { type: 'paste' }]);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const updateAction = (index: number, updates: Partial<ShortcutAction>) => {
    setActions(actions.map((a, i) => (i === index ? { ...a, ...updates } : a)));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isCreating ? '添加快捷方法' : '编辑快捷方法'}
      footer={
        <>
          {!isCreating && shortcut && !shortcut.isBuiltin && (
            <Button variant="danger" onClick={() => onDelete(shortcut.id)}>
              删除
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave}>保存</Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* 名称 */}
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
            名称
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="快捷方法名称"
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '14px',
              outline: 'none',
            }}
          />
        </div>

        {/* 类型 */}
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
            类型
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['template', 'action'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: 'none',
                  background: type === t ? 'var(--primary)' : 'var(--bg)',
                  color: type === t ? 'white' : 'var(--text)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                }}
              >
                {t === 'template' ? '📝 文本模板' : '⚡ 操作组合'}
              </button>
            ))}
          </div>
        </div>

        {/* 模板内容 */}
        {type === 'template' && (
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
              模板内容
            </label>
            <textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder="输入模板文本..."
              style={{
                width: '100%',
                minHeight: '100px',
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '14px',
                resize: 'vertical',
                outline: 'none',
              }}
            />
          </div>
        )}

        {/* 操作列表 */}
        {type === 'action' && (
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
              操作步骤
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {actions.map((action, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px',
                    background: 'var(--bg)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <span style={{ width: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    {index + 1}
                  </span>
                  <select
                    value={action.type}
                    onChange={(e) => updateAction(index, { type: e.target.value as ShortcutAction['type'] })}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '13px',
                    }}
                  >
                    <option value="paste">粘贴</option>
                    <option value="enter">回车</option>
                    <option value="wait">等待</option>
                    <option value="clear">清除</option>
                    <option value="clipboard">获取剪贴板</option>
                  </select>
                  {action.type === 'wait' && (
                    <input
                      type="number"
                      value={action.delay || 50}
                      onChange={(e) => updateAction(index, { delay: parseInt(e.target.value) })}
                      style={{
                        width: '80px',
                        padding: '6px 10px',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '13px',
                      }}
                      placeholder="毫秒"
                    />
                  )}
                  {action.type === 'paste' && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                      <input
                        type="checkbox"
                        checked={action.aiReply || false}
                        onChange={(e) => updateAction(index, { aiReply: e.target.checked })}
                      />
                      AI回复
                    </label>
                  )}
                  <button
                    onClick={() => removeAction(index)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '16px',
                      color: 'var(--danger)',
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={addAction}
                style={{
                  padding: '10px',
                  border: '2px dashed var(--border)',
                  background: 'transparent',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                }}
              >
                ➕ 添加步骤
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
