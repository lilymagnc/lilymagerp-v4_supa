// 이미지 압축 및 최적화 유틸리티

interface ImageOptimizeOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 - 1.0
  format?: 'jpeg' | 'webp' | 'png';
}

export async function optimizeImage(
  file: File, 
  options: ImageOptimizeOptions = {}
): Promise<File> {
  const {
    maxWidth = 1200,    // 배송완료 사진은 1200px로 충분
    maxHeight = 1200,
    quality = 0.8,      // 80% 품질 (크기와 품질의 균형)
    format = 'jpeg'     // JPEG가 가장 압축률이 좋음
  } = options;

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      try {
        // 원본 크기 계산
        let { width, height } = img;
        
        // 최대 크기에 맞게 비율 조정
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }

        // 캔버스 크기 설정
        canvas.width = width;
        canvas.height = height;

        // 이미지 그리기
        ctx?.drawImage(img, 0, 0, width, height);

        // 압축된 이미지로 변환
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const optimizedFile = new File(
                [blob], 
                `optimized_${file.name.replace(/\.[^/.]+$/, '')}.${format}`,
                { type: `image/${format}` }
              );
              resolve(optimizedFile);
            } else {
              reject(new Error('이미지 압축 실패'));
            }
          },
          `image/${format}`,
          quality
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error('이미지 로드 실패'));
    
    // 파일을 Data URL로 변환하여 이미지 로드
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// 파일 크기 검증 및 자동 압축
export async function validateAndOptimizeImage(file: File): Promise<{
  file: File;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
}> {
  const originalSize = file.size;
  
  // 5MB 이상이면 강제 압축
  if (originalSize > 5 * 1024 * 1024) {
    const optimizedFile = await optimizeImage(file, {
      maxWidth: 800,
      maxHeight: 800,
      quality: 0.6
    });
    
    return {
      file: optimizedFile,
      originalSize,
      optimizedSize: optimizedFile.size,
      compressionRatio: Math.round((1 - optimizedFile.size / originalSize) * 100)
    };
  }
  
  // 2MB 이상이면 일반 압축
  if (originalSize > 2 * 1024 * 1024) {
    const optimizedFile = await optimizeImage(file, {
      maxWidth: 1200,
      maxHeight: 1200,
      quality: 0.8
    });
    
    return {
      file: optimizedFile,
      originalSize,
      optimizedSize: optimizedFile.size,
      compressionRatio: Math.round((1 - optimizedFile.size / originalSize) * 100)
    };
  }

  // 작은 파일은 그대로 사용
  return {
    file,
    originalSize,
    optimizedSize: originalSize,
    compressionRatio: 0
  };
}

// 배치 이미지 최적화 (여러 이미지 동시 처리)
export async function batchOptimizeImages(
  files: File[],
  onProgress?: (current: number, total: number) => void
): Promise<Array<{ original: File; optimized: File; compressionRatio: number }>> {
  const results = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.(i + 1, files.length);
    
    try {
      const result = await validateAndOptimizeImage(file);
      results.push({
        original: file,
        optimized: result.file,
        compressionRatio: result.compressionRatio
      });
    } catch (error) {
      console.error(`이미지 최적화 실패: ${file.name}`, error);
      // 실패한 경우 원본 파일 사용
      results.push({
        original: file,
        optimized: file,
        compressionRatio: 0
      });
    }
  }
  
  return results;
}
