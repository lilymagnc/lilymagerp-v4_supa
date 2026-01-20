const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs } = require('firebase/firestore');

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

async function checkPaymentStatus() {
  try {
    console.log('🔍 현재 주문 데이터의 payment.status 상태를 확인하는 중...');
    
    // 모든 주문 조회
    const ordersRef = collection(db, 'orders');
    const querySnapshot = await getDocs(ordersRef);
    
    console.log(`📊 총 ${querySnapshot.size}개의 주문을 찾았습니다.`);
    
    const statusCounts = {
      'completed': 0,
      'paid': 0,
      'pending': 0,
      'undefined': 0,
      'other': 0
    };
    
    const completedOrders = [];
    
    querySnapshot.forEach((docSnapshot) => {
      const orderData = docSnapshot.data();
      const paymentStatus = orderData.payment?.status;
      
      if (paymentStatus === 'completed') {
        statusCounts.completed++;
        completedOrders.push({
          id: docSnapshot.id,
          name: orderData.orderer?.name || '이름 없음',
          amount: orderData.summary?.total || 0,
          date: orderData.orderDate?.toDate?.() || orderData.orderDate
        });
      } else if (paymentStatus === 'paid') {
        statusCounts.paid++;
      } else if (paymentStatus === 'pending') {
        statusCounts.pending++;
      } else if (paymentStatus === undefined) {
        statusCounts.undefined++;
      } else {
        statusCounts.other++;
      }
    });
    
    console.log('\n📈 Payment Status 통계:');
    console.log(`- completed: ${statusCounts.completed}개`);
    console.log(`- paid: ${statusCounts.paid}개`);
    console.log(`- pending: ${statusCounts.pending}개`);
    console.log(`- undefined: ${statusCounts.undefined}개`);
    console.log(`- 기타: ${statusCounts.other}개`);
    
    if (completedOrders.length > 0) {
      console.log('\n📋 "completed" 상태인 주문들:');
      completedOrders.forEach((order, index) => {
        const dateStr = order.date instanceof Date ? order.date.toLocaleDateString() : order.date;
        console.log(`${index + 1}. ID: ${order.id} - ${order.name} (${order.amount.toLocaleString()}원) - ${dateStr}`);
      });
    }
    
    console.log('\n💡 권장사항:');
    if (statusCounts.completed > 0) {
      console.log(`- ${statusCounts.completed}개의 주문을 'completed'에서 'paid'로 업데이트해야 합니다.`);
      console.log('- update-payment-status.js 스크립트를 실행하세요.');
    } else {
      console.log('- 모든 주문이 올바른 상태입니다.');
    }
    
  } catch (error) {
    console.error('❌ 확인 중 오류 발생:', error);
  }
}

// 스크립트 실행
checkPaymentStatus()
  .then(() => {
    console.log('\n🏁 확인 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 확인 실패:', error);
    process.exit(1);
  });
