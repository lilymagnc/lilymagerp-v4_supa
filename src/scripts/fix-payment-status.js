const admin = require('firebase-admin');

// Firebase Admin SDK 초기화
// 환경 변수나 서비스 계정 키를 사용
let serviceAccount;

try {
  // 먼저 서비스 계정 키 파일을 시도
  serviceAccount = require('./serviceAccountKey.json');
} catch (error) {
  // 파일이 없으면 환경 변수 사용
  serviceAccount = {
    type: "service_account",
    project_id: "lilymagerp-fs1",
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
  };
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "lilymagerp-fs1"
});

const db = admin.firestore();

async function fixPaymentStatus() {
  try {
    console.log('🔍 결제 상태 데이터 수정 시작...');
    
    // 1. 주문 상태가 'completed'이지만 결제 상태가 'pending'인 주문들을 찾기
    const ordersRef = db.collection('orders');
    const q = ordersRef
      .where('status', '==', 'completed')
      .where('payment.status', '==', 'pending');
    
    const querySnapshot = await q.get();
    console.log(`📊 발견된 주문 수: ${querySnapshot.size}`);
    
    if (querySnapshot.size === 0) {
      console.log('✅ 수정할 주문이 없습니다.');
      return;
    }
    
    let updatedCount = 0;
    
    for (const docSnapshot of querySnapshot.docs) {
      const orderData = docSnapshot.data();
      
      console.log(`🔄 주문 ID: ${docSnapshot.id}`);
      console.log(`   - 주문자: ${orderData.orderer?.name || 'N/A'}`);
      console.log(`   - 주문 상태: ${orderData.status}`);
      console.log(`   - 결제 상태: ${orderData.payment?.status}`);
      console.log(`   - 주문일: ${orderData.orderDate?.toDate?.() || orderData.orderDate}`);
      
      // 결제 상태를 'paid'로 변경하고 completedAt 설정
      const updateData = {
        'payment.status': 'paid',
        'payment.completedAt': orderData.orderDate || admin.firestore.FieldValue.serverTimestamp()
      };
      
      await docSnapshot.ref.update(updateData);
      updatedCount++;
      
      console.log(`   ✅ 업데이트 완료: payment.status = 'paid'`);
    }
    
    console.log(`\n🎉 수정 완료!`);
    console.log(`   - 총 처리된 주문: ${updatedCount}건`);
    
  } catch (error) {
    console.error('❌ 오류 발생:', error);
  }
}

// 스크립트 실행
fixPaymentStatus();
