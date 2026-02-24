'use client';

/**
 * ImageUpload Component
 *
 * Handles image selection from gallery or drag & drop
 */

import { useState, useRef, useCallback } from 'react';

interface ImageUploadProps {
  onUpload: (imageDataUrl: string) => void;
  onError?: (error: Error) => void;
  accept?: string;
  maxSizeMB?: number;
}

export function ImageUpload({
  onUpload,
  onError,
  accept = 'image/*',
  maxSizeMB = 10,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        onError?.(new Error('请选择图片文件'));
        return;
      }

      // Validate file size
      const maxBytes = maxSizeMB * 1024 * 1024;
      if (file.size > maxBytes) {
        onError?.(new Error(`图片大小不能超过 ${maxSizeMB}MB`));
        return;
      }

      setIsUploading(true);

      try {
        // Convert to data URL
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          onUpload(dataUrl);
          setIsUploading(false);
        };
        reader.onerror = () => {
          onError?.(new Error('读取图片失败'));
          setIsUploading(false);
        };
        reader.readAsDataURL(file);
      } catch (err) {
        onError?.(err instanceof Error ? err : new Error('处理图片失败'));
        setIsUploading(false);
      }
    },
    [onUpload, onError, maxSizeMB]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files?.[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => inputRef.current?.click()}
      className={`
        aspect-[4/3] rounded-2xl border-2 border-dashed cursor-pointer
        flex items-center justify-center transition-all
        ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-slate-500 hover:border-slate-400'}
        ${isUploading ? 'pointer-events-none opacity-50' : ''}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="text-center">
        {isUploading ? (
          <>
            <div className="text-4xl mb-2 animate-spin">⏳</div>
            <p className="text-slate-400">处理中...</p>
          </>
        ) : (
          <>
            <div className="text-4xl mb-2">📁</div>
            <p className="text-slate-400">
              {isDragging ? '松开上传' : '点击或拖拽上传图片'}
            </p>
            <p className="text-slate-500 text-sm mt-1">支持 JPG、PNG，最大 {maxSizeMB}MB</p>
          </>
        )}
      </div>
    </div>
  );
}
