const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, updateDoc, doc, serverTimestamp, writeBatch } = require('firebase/firestore');

// Firebase 설정
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

async function migratePaymentStatus() {
  console.log('🔧 결제 상태 마이그레이션 시작...');
  
  try {
    // 1. completed 상태를 paid로 변경하고 completedAt 설정
    console.log('📋 1단계: completed → paid 마이그레이션...');
    const completedQuery = query(
      collection(db, 'orders'),
      where('payment.status', '==', 'completed')
    );
    
    const completedSnapshot = await getDocs(completedQuery);
    console.log(`📊 completed 상태 주문 발견: ${completedSnapshot.size}건`);
    
    if (completedSnapshot.size > 0) {
      const batch = writeBatch(db);
      let count = 0;
      
      completedSnapshot.forEach((docSnapshot) => {
        const orderData = docSnapshot.data();
        const orderDate = orderData.orderDate;
        
        // completedAt 설정: orderDate가 있으면 사용, 없으면 현재 시간
        const completedAt = orderDate || serverTimestamp();
        
        batch.update(doc(db, 'orders', docSnapshot.id), {
          'payment.status': 'paid',
          'payment.completedAt': completedAt
        });
        
        count++;
        if (count % 100 === 0) {
          console.log(`⏳ 처리 중: ${count}/${completedSnapshot.size}`);
        }
      });
      
      await batch.commit();
      console.log(`✅ completed → paid 마이그레이션 완료: ${count}건`);
    }
    
    // 2. paid 상태이지만 completedAt이 없는 주문들 처리
    console.log('📋 2단계: paid 상태 completedAt 설정...');
    const paidQuery = query(
      collection(db, 'orders'),
      where('payment.status', '==', 'paid')
    );
    
    const paidSnapshot = await getDocs(paidQuery);
    console.log(`📊 paid 상태 주문 발견: ${paidSnapshot.size}건`);
    
    let missingCompletedAtCount = 0;
    const batch2 = writeBatch(db);
    
    paidSnapshot.forEach((docSnapshot) => {
      const orderData = docSnapshot.data();
      
      // completedAt이 없거나 null인 경우에만 설정
      if (!orderData.payment?.completedAt) {
        const orderDate = orderData.orderDate;
        const completedAt = orderDate || serverTimestamp();
        
        batch2.update(doc(db, 'orders', docSnapshot.id), {
          'payment.completedAt': completedAt
        });
        
        missingCompletedAtCount++;
      }
    });
    
    if (missingCompletedAtCount > 0) {
      await batch2.commit();
      console.log(`✅ paid 상태 completedAt 설정 완료: ${missingCompletedAtCount}건`);
    } else {
      console.log('✅ 모든 paid 주문에 completedAt이 이미 설정되어 있습니다.');
    }
    
    console.log('🎉 마이그레이션 완료!');
    
  } catch (error) {
    console.error('❌ 마이그레이션 중 오류 발생:', error);
    throw error;
  }
}

// 스크립트 실행
migratePaymentStatus()
  .then(() => {
    console.log('✅ 마이그레이션이 성공적으로 완료되었습니다.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 마이그레이션 실패:', error);
    process.exit(1);
  });
