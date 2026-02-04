import { useState, useRef, useCallback } from 'react';
import { useAppStore } from '../stores/appStore';
import { Button, Modal } from './common';
import { showToast } from './common/Toast';
import type { FileInfo } from '../types';

interface FilePanelProps {
  token: string;
  onRefresh: () => void;
  onDelete: (filename: string, category: string) => void;
}

type FileCategory = 'all' | 'images' | 'videos' | 'files';

export function FilePanel({ token, onRefresh, onDelete }: FilePanelProps) {
  const { files } = useAppStore();
  const [category, setCategory] = useState<FileCategory>('all');
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewFile, setPreviewFile] = useState<FileInfo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredFiles = files.filter(
    (f) => category === 'all' || f.category === category
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      uploadFiles(droppedFiles);
    }
  }, [token]);

  const uploadFiles = async (fileList: FileList) => {
    const formData = new FormData();
    for (let i = 0; i < fileList.length; i++) {
      formData.append('files', fileList[i]);
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      xhr.addEventListener('load', () => {
        setUploading(false);
        if (xhr.status === 200) {
          showToast(`上传成功 (${fileList.length} 个文件)`, 'success');
          onRefresh();
        } else {
          showToast('上传失败', 'error');
        }
      });

      xhr.addEventListener('error', () => {
        setUploading(false);
        showToast('上传失败', 'error');
      });

      xhr.open('POST', `/api/upload?token=${token}`);
      xhr.send(formData);
    } catch {
      setUploading(false);
      showToast('上传失败', 'error');
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
      e.target.value = '';
    }
  };

  const getFileIcon = (file: FileInfo) => {
    if (file.category === 'images') return '🖼️';
    if (file.category === 'videos') return '🎬';
    if (file.mimeType?.includes('pdf')) return '📄';
    if (file.mimeType?.includes('zip') || file.mimeType?.includes('rar')) return '📦';
    return '📎';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB';
  };

  const handleDownload = (file: FileInfo) => {
    const url = `/files/${encodeURIComponent(file.filename)}?category=${file.category}&token=${token}`;
    window.open(url, '_blank');
  };

  const handlePreview = (file: FileInfo) => {
    if (file.category === 'images' || file.category === 'videos') {
      setPreviewFile(file);
    } else {
      handleDownload(file);
    }
  };

  const handleDeleteFile = (file: FileInfo) => {
    if (confirm(`确定删除 ${file.filename}？`)) {
      onDelete(file.filename, file.category);
    }
  };

  const categories: { id: FileCategory; label: string }[] = [
    { id: 'all', label: '全部' },
    { id: 'images', label: '图片' },
    { id: 'videos', label: '视频' },
    { id: 'files', label: '文件' },
  ];

  return (
    <div>
      {/* 上传区域 */}
      <div
        onClick={handleFileSelect}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          background: isDragging ? '#f0f4ff' : 'var(--card)',
          border: `2px dashed ${isDragging ? 'var(--primary)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-lg)',
          padding: '32px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
          marginBottom: '16px',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>📤</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          点击或拖拽文件到这里上传
          <br />
          支持图片、视频、文档等
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.txt,.md"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>

      {/* 上传进度 */}
      {uploading && (
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              height: '8px',
              background: 'var(--bg)',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                background: 'var(--primary)',
                borderRadius: '4px',
                transition: 'width 0.3s',
                width: `${uploadProgress}%`,
              }}
            />
          </div>
          <div
            style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              marginTop: '8px',
              textAlign: 'center',
            }}
          >
            上传中... {uploadProgress}%
          </div>
        </div>
      )}

      {/* 文件列表 */}
      <div
        style={{
          background: 'var(--card)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow)',
          overflow: 'hidden',
        }}
      >
        {/* 头部 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid var(--bg)',
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: 600 }}>📁 已上传文件</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                style={{
                  padding: '4px 12px',
                  border: 'none',
                  background: category === cat.id ? 'var(--primary)' : 'var(--bg)',
                  color: category === cat.id ? 'white' : 'var(--text)',
                  borderRadius: '12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* 文件列表 */}
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {filteredFiles.length === 0 ? (
            <div
              style={{
                padding: '32px',
                textAlign: 'center',
                color: 'var(--text-secondary)',
              }}
            >
              暂无文件
            </div>
          ) : (
            filteredFiles.map((file) => (
              <div
                key={file.filename}
                onClick={() => handlePreview(file)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--bg)',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                <span style={{ fontSize: '32px' }}>{getFileIcon(file)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {file.filename}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {formatFileSize(file.size)} · {file.category}
                    {file.userName && ` · ${file.userName}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" onClick={() => handleDownload(file)}>
                    下载
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => handleDeleteFile(file)}>
                    删除
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 预览模态框 */}
      <Modal
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
        title={previewFile?.filename}
        width="90%"
      >
        {previewFile && (
          <div style={{ textAlign: 'center' }}>
            {previewFile.category === 'images' ? (
              <img
                src={`/files/${encodeURIComponent(previewFile.filename)}?category=${previewFile.category}&token=${token}`}
                alt={previewFile.filename}
                style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: '8px' }}
              />
            ) : previewFile.category === 'videos' ? (
              <video
                src={`/files/${encodeURIComponent(previewFile.filename)}?category=${previewFile.category}&token=${token}`}
                controls
                autoPlay
                style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: '8px' }}
              />
            ) : null}
          </div>
        )}
      </Modal>
    </div>
  );
}
