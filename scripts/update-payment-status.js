const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, updateDoc, doc } = require('firebase/firestore');

// Firebase 설정 (직접 설정)
const firebaseConfig = {
  apiKey: "AIzaSyApy5zme7H15h1UZd1B9hBDOOWgpbvOLJ4",
  authDomain: "lilymagerp-fs1.firebaseapp.com",
  databaseURL: "https://lilymagerp-fs1-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "lilymagerp-fs1",
  storageBucket: "lilymagerp-fs1.firebasestorage.app",
  messagingSenderId: "1069828102888",
  appId: "1:1069828102888:web:24927eab4719f3e75d475d",
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function updatePaymentStatus() {
  try {
    console.log('🔍 payment.status가 "completed"인 주문들을 찾는 중...');
    
    // payment.status가 'completed'인 주문들 조회
    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, where('payment.status', '==', 'completed'));
    const querySnapshot = await getDocs(q);
    
    console.log(`📊 총 ${querySnapshot.size}개의 주문을 찾았습니다.`);
    
    if (querySnapshot.size === 0) {
      console.log('✅ 업데이트할 주문이 없습니다.');
      return;
    }
    
    // 배치 업데이트를 위한 배열
    const updatePromises = [];
    let updatedCount = 0;
    
    querySnapshot.forEach((docSnapshot) => {
      const orderData = docSnapshot.data();
      console.log(`🔄 주문 ID: ${docSnapshot.id} - ${orderData.orderer?.name || '이름 없음'} (${orderData.summary?.total || 0}원)`);
      
      const updatePromise = updateDoc(doc(db, 'orders', docSnapshot.id), {
        'payment.status': 'paid'
      }).then(() => {
        updatedCount++;
        console.log(`✅ 주문 ID: ${docSnapshot.id} 업데이트 완료`);
      }).catch((error) => {
        console.error(`❌ 주문 ID: ${docSnapshot.id} 업데이트 실패:`, error);
      });
      
      updatePromises.push(updatePromise);
    });
    
    // 모든 업데이트 완료 대기
    await Promise.all(updatePromises);
    
    console.log(`🎉 업데이트 완료! 총 ${updatedCount}개의 주문이 업데이트되었습니다.`);
    
  } catch (error) {
    console.error('❌ 업데이트 중 오류 발생:', error);
  }
}

// 스크립트 실행
updatePaymentStatus()
  .then(() => {
    console.log('🏁 스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 스크립트 실행 실패:', error);
    process.exit(1);
  });
