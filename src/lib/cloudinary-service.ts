// Cloudinary 무료 이미지 호스팅 서비스
// 무료 플랜: 25 credits/월 (약 25GB 대역폭, 25,000 변환)

interface CloudinaryConfig {
  cloudName: string;
  uploadPreset: string; // unsigned upload preset 필요
}

// 환경 변수에서 설정 가져오기
const CLOUDINARY_CONFIG: CloudinaryConfig = {
  cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'your-cloud-name',
  uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'your-upload-preset'
};

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  created_at: string;
}

// Cloudinary에 이미지 업로드
export async function uploadToCloudinary(
  file: File,
  options: {
    folder?: string;
    transformation?: string;
    tags?: string[];
  } = {}
): Promise<CloudinaryUploadResult> {
  const { folder = 'delivery-photos', transformation, tags = [] } = options;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
  
  if (folder) {
    formData.append('folder', folder);
  }
  
  if (transformation) {
    formData.append('transformation', transformation);
  }
  
  if (tags.length > 0) {
    formData.append('tags', tags.join(','));
  }

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`Cloudinary 업로드 실패: ${response.statusText}`);
    }

    const result: CloudinaryUploadResult = await response.json();
    return result;
  } catch (error) {
    console.error('Cloudinary 업로드 오류:', error);
    throw new Error('이미지 업로드에 실패했습니다.');
  }
}

// Cloudinary에서 이미지 삭제
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  // 클라이언트에서는 직접 삭제할 수 없으므로 서버 API를 통해야 함
  try {
    const response = await fetch('/api/cloudinary/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ public_id: publicId }),
    });

    if (!response.ok) {
      throw new Error('이미지 삭제 실패');
    }
  } catch (error) {
    console.error('Cloudinary 삭제 오류:', error);
    throw error;
  }
}

// 이미지 변환 URL 생성 (리사이징, 품질 조정 등)
export function generateCloudinaryUrl(
  publicId: string,
  transformations: {
    width?: number;
    height?: number;
    quality?: number | 'auto';
    format?: 'jpg' | 'png' | 'webp' | 'auto';
    crop?: 'fill' | 'fit' | 'scale' | 'crop';
  } = {}
): string {
  const { width, height, quality = 'auto', format = 'auto', crop = 'fit' } = transformations;

  let transformationString = '';
  const parts: string[] = [];

  if (width || height) {
    const dimensions = [];
    if (width) dimensions.push(`w_${width}`);
    if (height) dimensions.push(`h_${height}`);
    if (crop) dimensions.push(`c_${crop}`);
    parts.push(dimensions.join(','));
  }

  if (quality) {
    parts.push(`q_${quality}`);
  }

  if (format) {
    parts.push(`f_${format}`);
  }

  if (parts.length > 0) {
    transformationString = parts.join('/') + '/';
  }

  return `https://res.cloudinary.com/${CLOUDINARY_CONFIG.cloudName}/image/upload/${transformationString}${publicId}`;
}

// 이미지 메타데이터 가져오기
export async function getImageMetadata(publicId: string): Promise<any> {
  try {
    const response = await fetch(
      `https://res.cloudinary.com/${CLOUDINARY_CONFIG.cloudName}/image/upload/${publicId}.json`
    );
    
    if (!response.ok) {
      throw new Error('메타데이터 조회 실패');
    }
    
    return await response.json();
  } catch (error) {
    console.error('이미지 메타데이터 조회 오류:', error);
    throw error;
  }
}
