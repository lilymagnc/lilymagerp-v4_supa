const fs = require('fs');
const path = require('path');

// 정리할 파일 확장자들
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

// 제거할 패턴들
const PATTERNS_TO_REMOVE = [
  /console\.log\([^)]*\);?\s*/g,
  /\/\/ 임시.*$/gm,
  /\/\/ 테스트.*$/gm,
  /\/\/ 디버그.*$/gm,
  /\/\/ 개발용.*$/gm,
  /\/\/ TODO.*$/gm,
  /\/\/ FIXME.*$/gm,
  /\/\/ HACK.*$/gm,
  /\/\/ XXX.*$/gm,
  /\/\/ 주석.*$/gm,
  /\/\/ 이전.*$/gm,
  /\/\/ 추가.*$/gm,
  /\/\/ 해결.*$/gm,
];

// 빈 줄 정리
const CLEANUP_EMPTY_LINES = [
  /\n\s*\n\s*\n/g, // 3개 이상 연속된 빈 줄을 2개로
  /^\s*\n/gm, // 파일 시작의 빈 줄
  /\n\s*$/g, // 파일 끝의 빈 줄
];

function cleanupFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    
    // 패턴 제거
    PATTERNS_TO_REMOVE.forEach(pattern => {
      content = content.replace(pattern, '');
    });
    
    // 빈 줄 정리
    CLEANUP_EMPTY_LINES.forEach(pattern => {
      content = content.replace(pattern, '\n');
    });
    
    // 파일 끝에 개행 추가
    if (!content.endsWith('\n')) {
      content += '\n';
    }
    
    // 변경사항이 있으면 파일 저장
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ 정리됨: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ 오류: ${filePath} - ${error.message}`);
    return false;
  }
}

function walkDir(dir) {
  const files = [];
  
  function walk(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // node_modules와 .git 폴더 제외
        if (item !== 'node_modules' && item !== '.git' && !item.startsWith('.')) {
          walk(fullPath);
        }
      } else if (EXTENSIONS.includes(path.extname(item))) {
        files.push(fullPath);
      }
    }
  }
  
  walk(dir);
  return files;
}

function main() {
  const srcDir = path.join(__dirname, '..', 'src');
  
  if (!fs.existsSync(srcDir)) {
    console.error('❌ src 폴더를 찾을 수 없습니다.');
    process.exit(1);
  }
  
  console.log('🧹 코드 정리 시작...');
  
  const files = walkDir(srcDir);
  let cleanedCount = 0;
  
  for (const file of files) {
    if (cleanupFile(file)) {
      cleanedCount++;
    }
  }
  
  console.log(`\n✨ 정리 완료! ${cleanedCount}개 파일이 정리되었습니다.`);
}

if (require.main === module) {
  main();
}

module.exports = { cleanupFile, walkDir };


