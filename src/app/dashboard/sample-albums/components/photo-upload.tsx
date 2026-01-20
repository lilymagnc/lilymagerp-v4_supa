'use client';
import { useState, useCallback, useRef } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { UploadProgress } from '@/types/album';
import { FirebaseStorageService } from '@/lib/firebase-storage';
interface PhotoUploadProps {
  albumId: string;
  onUploadComplete: (files: File[]) => Promise<void>;
  onCancel: () => void;
}
export function PhotoUpload({ albumId, onUploadComplete, onCancel }: PhotoUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    const fileArray = Array.from(selectedFiles);
    // 파일 검증
    const validFiles = fileArray.filter(file => {
      const validation = FirebaseStorageService.validateFile(file);
      if (!validation.isValid) {
        alert(`${file.name}: ${validation.error}`);
        return false;
      }
      return true;
    });
    setFiles(prev => [...prev, ...validFiles]);
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    handleFileSelect(e.dataTransfer.files);
  };
  const handleClick = () => {
    fileInputRef.current?.click();
  };
  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };
  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      await onUploadComplete(files);
      setFiles([]);
      setUploadProgress([]);
    } catch (error) {
      console.error('업로드 실패:', error);
      alert('업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* 드래그 앤 드롭 영역 */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClick}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
            />
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            {isDragActive ? (
              <p className="text-blue-600">파일을 여기에 놓으세요...</p>
            ) : (
              <div>
                <p className="text-lg font-medium text-gray-900 mb-2">
                  사진을 드래그하거나 클릭해서 업로드
                </p>
                <p className="text-sm text-gray-500">
                  JPEG, PNG, WebP 파일 지원 (최대 10MB)
                </p>
              </div>
            )}
          </div>
          {/* 선택된 파일 목록 */}
          {files.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium">선택된 파일 ({files.length}개)</h4>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <ImageIcon className="h-8 w-8 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium truncate max-w-xs">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      disabled={uploading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* 업로드 진행률 */}
          {uploadProgress.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium">업로드 진행률</h4>
              <div className="space-y-2">
                {uploadProgress.map((progress, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate max-w-xs">{progress.filename}</span>
                      <div className="flex items-center space-x-2">
                        {progress.status === 'completed' && (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                        {progress.status === 'error' && (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className="text-xs">
                          {progress.status === 'error' ? '실패' : `${progress.progress}%`}
                        </span>
                      </div>
                    </div>
                    <Progress value={progress.progress} className="h-2" />
                    {progress.error && (
                      <p className="text-xs text-red-500">{progress.error}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* 액션 버튼 */}
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={uploading}
            >
              취소
            </Button>
            <Button
              onClick={handleUpload}
              disabled={files.length === 0 || uploading}
            >
              {uploading ? '업로드 중...' : `${files.length}개 파일 업로드`}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
