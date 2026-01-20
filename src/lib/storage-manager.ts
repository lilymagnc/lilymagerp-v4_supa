// 통합 저장소 관리 시스템

import { uploadFile as uploadToFirebase, deleteFile as deleteFromFirebase } from './firebase-storage';
import { uploadToCloudinary, deleteFromCloudinary, CloudinaryUploadResult } from './cloudinary-service';
import { validateAndOptimizeImage } from './image-optimizer';

export type StorageProvider = 'firebase' | 'cloudinary' | 'auto';

export interface StorageConfig {
  provider: StorageProvider;
  autoOptimize: boolean;
  maxFileSize: number; // MB
  preferredProvider?: StorageProvider; // auto 모드일 때 선호하는 제공자
}

export interface UploadResult {
  url: string;
  provider: StorageProvider;
  publicId?: string; // Cloudinary용
  originalSize: number;
  finalSize: number;
  compressionRatio: number;
}

class StorageManager {
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
  }

  // 최적의 저장소 선택
  private selectProvider(fileSize: number): StorageProvider {
    if (this.config.provider !== 'auto') {
      return this.config.provider;
    }

    // Firebase Storage 5GB 제한 고려
    // 2MB 이상 파일은 Cloudinary 우선 고려
    if (fileSize > 2 * 1024 * 1024) {
      return 'cloudinary';
    }

    return this.config.preferredProvider || 'firebase';
  }

  async uploadFile(
    file: File,
    path: string,
    options: {
      tags?: string[];
      transformation?: string;
    } = {}
  ): Promise<UploadResult> {
    const originalSize = file.size;
    let processedFile = file;
    let compressionRatio = 0;

    // 이미지 최적화 (선택적)
    if (this.config.autoOptimize && file.type.startsWith('image/')) {
      const optimizationResult = await validateAndOptimizeImage(file);
      processedFile = optimizationResult.file;
      compressionRatio = optimizationResult.compressionRatio;
    }

    // 저장소 선택
    const provider = this.selectProvider(processedFile.size);

    try {
      let url: string;
      let publicId: string | undefined;

      switch (provider) {
        case 'firebase':
          url = await uploadToFirebase(processedFile, path);
          break;

        case 'cloudinary':
          const cloudinaryResult = await uploadToCloudinary(processedFile, {
            folder: path.split('/')[0], // 첫 번째 경로를 폴더로 사용
            tags: options.tags,
            transformation: options.transformation,
          });
          url = cloudinaryResult.secure_url;
          publicId = cloudinaryResult.public_id;
          break;

        default:
          throw new Error(`지원하지 않는 저장소: ${provider}`);
      }

      return {
        url,
        provider,
        publicId,
        originalSize,
        finalSize: processedFile.size,
        compressionRatio,
      };
    } catch (error) {
      console.error(`${provider} 업로드 실패:`, error);

      // Auto 모드에서 실패 시 다른 제공자로 재시도
      if (this.config.provider === 'auto') {
        const fallbackProvider = provider === 'firebase' ? 'cloudinary' : 'firebase';


        try {
          const tempManager = new StorageManager({
            ...this.config,
            provider: fallbackProvider,
          });
          return await tempManager.uploadFile(processedFile, path, options);
        } catch (fallbackError) {
          console.error('모든 저장소에서 업로드 실패:', fallbackError);
          throw new Error('파일 업로드에 실패했습니다.');
        }
      }

      throw error;
    }
  }

  async deleteFile(url: string, publicId?: string): Promise<void> {
    try {
      if (url.includes('cloudinary.com')) {
        if (!publicId) {
          // URL에서 public_id 추출
          const urlParts = url.split('/');
          const imageIndex = urlParts.findIndex(part => part === 'image');
          if (imageIndex !== -1 && imageIndex + 2 < urlParts.length) {
            const pathParts = urlParts.slice(imageIndex + 2);
            publicId = pathParts.join('/').split('.')[0]; // 확장자 제거
          }
        }

        if (publicId) {
          await deleteFromCloudinary(publicId);
        }
      } else {
        await deleteFromFirebase(url);
      }
    } catch (error) {
      console.error('파일 삭제 실패:', error);
      throw error;
    }
  }

  // 용량 사용량 체크
  async getStorageUsage(): Promise<{
    firebase: { used: number; limit: number };
    cloudinary: { used: number; limit: number };
  }> {
    // 실제로는 각 서비스 API를 통해 사용량을 조회해야 함
    // 여기서는 추정치 반환
    return {
      firebase: { used: 0, limit: 5 * 1024 * 1024 * 1024 }, // 5GB
      cloudinary: { used: 0, limit: 25 * 1024 * 1024 * 1024 }, // 25GB 대역폭
    };
  }
}

// 기본 설정으로 저장소 매니저 생성
export const createStorageManager = (config?: Partial<StorageConfig>): StorageManager => {
  const defaultConfig: StorageConfig = {
    provider: 'auto',
    autoOptimize: true,
    maxFileSize: 10, // 10MB
    preferredProvider: 'firebase',
  };

  return new StorageManager({ ...defaultConfig, ...config });
};

// 전역 저장소 매니저 (기본 설정)
export const defaultStorageManager = createStorageManager();

// 편의 함수들
export const uploadWithOptimalStorage = (
  file: File,
  path: string,
  options?: { tags?: string[]; transformation?: string }
) => defaultStorageManager.uploadFile(file, path, options);

export const deleteFromOptimalStorage = (url: string, publicId?: string) =>
  defaultStorageManager.deleteFile(url, publicId);
