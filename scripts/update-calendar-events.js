const admin = require('firebase-admin');

// Firebase 초기화 (서비스 계정 키 파일 경로를 확인하세요)
const serviceAccount = require('../path/to/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function updateCalendarEvents() {
  try {
    console.log('캘린더 이벤트 업데이트 시작...');
    
    const eventsRef = db.collection('calendarEvents');
    const snapshot = await eventsRef.get();
    
    if (snapshot.empty) {
      console.log('업데이트할 이벤트가 없습니다.');
      return;
    }
    
    const batch = db.batch();
    let updateCount = 0;
    
    snapshot.forEach(doc => {
      const eventData = doc.data();
      
      // createdByRole과 createdByBranch가 없는 경우에만 업데이트
      if (!eventData.createdByRole || !eventData.createdByBranch) {
        const updateData = {};
        
        // createdByRole이 없는 경우 기본값 설정
        if (!eventData.createdByRole) {
          updateData.createdByRole = '지점 관리자'; // 기본값
        }
        
        // createdByBranch가 없는 경우 branchName에서 추출
        if (!eventData.createdByBranch) {
          updateData.createdByBranch = eventData.branchName || '알 수 없음';
        }
        
        // 업데이트 배치에 추가
        batch.update(doc.ref, updateData);
        updateCount++;
        
        console.log(`이벤트 ${doc.id} 업데이트:`, updateData);
      }
    });
    
    if (updateCount > 0) {
      await batch.commit();
      console.log(`${updateCount}개의 이벤트가 성공적으로 업데이트되었습니다.`);
    } else {
      console.log('업데이트가 필요한 이벤트가 없습니다.');
    }
    
  } catch (error) {
    console.error('캘린더 이벤트 업데이트 중 오류 발생:', error);
  }
}

// 스크립트 실행
updateCalendarEvents()
  .then(() => {
    console.log('마이그레이션 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('마이그레이션 실패:', error);
    process.exit(1);
  });
