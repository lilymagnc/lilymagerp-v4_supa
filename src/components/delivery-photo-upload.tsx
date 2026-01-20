"use client"

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Camera, Upload, X, Check } from 'lucide-react'
import { uploadWithOptimalStorage, deleteFromOptimalStorage } from '@/lib/storage-manager'
import { useAuth } from '@/hooks/use-auth'
import Image from 'next/image'

interface DeliveryPhotoUploadProps {
  orderId: string
  currentPhotoUrl?: string
  onPhotoUploaded: (photoUrl: string) => void
  onPhotoRemoved: () => void
}

export function DeliveryPhotoUpload({ 
  orderId, 
  currentPhotoUrl, 
  onPhotoUploaded, 
  onPhotoRemoved 
}: DeliveryPhotoUploadProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [optimizationInfo, setOptimizationInfo] = useState<{
    originalSize: number;
    optimizedSize: number;
    compressionRatio: number;
    provider?: string;
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const { user } = useAuth()

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // 이미지 파일 타입 체크
    if (!file.type.startsWith('image/')) {
      toast({
        title: "파일 형식 오류", 
        description: "이미지 파일만 업로드 가능합니다.",
        variant: "destructive"
      })
      return
    }

    setSelectedFile(file)
    setOptimizationInfo({
      originalSize: file.size,
      optimizedSize: file.size,
      compressionRatio: 0
    })
    
    // 미리보기 생성
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    
    // 인증 상태 확인
    if (!user) {
      toast({
        title: "인증 필요",
        description: "파일을 업로드하려면 로그인이 필요합니다.",
        variant: "destructive"
      })
      return
    }

    setUploading(true)
    try {
      // 최적 저장소에 업로드 (자동 최적화 포함)
      const fileName = `delivery-photos/${orderId}/${Date.now()}-${selectedFile.name}`
      const uploadResult = await uploadWithOptimalStorage(selectedFile, fileName, {
        tags: ['delivery-photo', orderId]
      })
      
      // 기존 사진이 있다면 삭제
      if (currentPhotoUrl) {
        try {
          await deleteFromOptimalStorage(currentPhotoUrl)
        } catch (error) {
          console.warn('기존 사진 삭제 실패:', error)
        }
      }

      // 최적화 정보 업데이트
      setOptimizationInfo(prev => ({
        ...prev!,
        optimizedSize: uploadResult.finalSize,
        compressionRatio: uploadResult.compressionRatio,
        provider: uploadResult.provider
      }))

      onPhotoUploaded(uploadResult.url)
      setIsOpen(false)
      setPreviewUrl(null)
      setSelectedFile(null)
      
      toast({
        title: "업로드 완료",
        description: `${uploadResult.provider === 'firebase' ? 'Firebase' : 'Cloudinary'}에 사진이 업로드되었습니다.${uploadResult.compressionRatio > 0 ? ` (${uploadResult.compressionRatio}% 압축됨)` : ''}`
      })
    } catch (error) {
      console.error('업로드 실패:', error)
      toast({
        title: "업로드 실패",
        description: "사진 업로드 중 오류가 발생했습니다.",
        variant: "destructive"
      })
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = async () => {
    if (!currentPhotoUrl) return

    try {
      await deleteFromOptimalStorage(currentPhotoUrl)
      onPhotoRemoved()
      
      toast({
        title: "삭제 완료",
        description: "배송완료 사진이 삭제되었습니다."
      })
    } catch (error) {
      console.error('삭제 실패:', error)
      toast({
        title: "삭제 실패", 
        description: "사진 삭제 중 오류가 발생했습니다.",
        variant: "destructive"
      })
    }
  }

  const resetDialog = () => {
    setPreviewUrl(null)
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-2">
      {currentPhotoUrl ? (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(currentPhotoUrl, '_blank')}
            className="text-green-600"
          >
            <Check className="h-4 w-4 mr-1" />
            사진 보기
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRemove}
            className="text-red-600"
          >
            <X className="h-4 w-4 mr-1" />
            삭제
          </Button>
        </div>
      ) : (
        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open)
          if (!open) resetDialog()
        }}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Camera className="h-4 w-4 mr-1" />
              사진 업로드
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>배송완료 사진 업로드</DialogTitle>
              <DialogDescription>
                고객에게 전송할 배송완료 확인 사진을 업로드하세요.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="photo">사진 선택</Label>
                <Input
                  ref={fileInputRef}
                  id="photo"
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="cursor-pointer"
                />
                <p className="text-xs text-gray-500">
                  JPG, PNG, GIF 파일 (최대 5MB)
                </p>
              </div>

              {previewUrl && (
                <div className="space-y-2">
                  <Label>미리보기</Label>
                  <div className="relative w-full h-48 border rounded-md overflow-hidden">
                    <Image
                      src={previewUrl}
                      alt="배송완료 사진 미리보기"
                      fill
                      className="object-cover"
                    />
                  </div>
                  {optimizationInfo && (
                    <div className="text-xs text-gray-500 space-y-1">
                      <div>파일 크기: {(optimizationInfo.originalSize / 1024 / 1024).toFixed(2)}MB</div>
                      {optimizationInfo.provider && (
                        <div className="text-blue-600">
                          📡 {optimizationInfo.provider === 'firebase' ? 'Firebase Storage' : 'Cloudinary'} 사용 예정
                        </div>
                      )}
                      {optimizationInfo.compressionRatio > 0 && (
                        <div className="text-green-600 font-medium">
                          💾 {optimizationInfo.compressionRatio}% 압축됨
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={uploading}
                >
                  취소
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                >
                  {uploading ? (
                    <>
                      <Upload className="h-4 w-4 mr-2 animate-spin" />
                      업로드 중...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      업로드
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
