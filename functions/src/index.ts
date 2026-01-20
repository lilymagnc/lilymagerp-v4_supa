/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

// 자동 백업 함수 (매일 새벽 2시에 실행)
export const autoBackup = functions.pubsub
  .schedule('0 2 * * *') // 매일 새벽 2시
  .timeZone('Asia/Seoul')
  .onRun(async (context) => {
    try {
      const db = admin.firestore();
      const timestamp = admin.firestore.Timestamp.now();
      
      // 백업할 컬렉션들
      const collections = [
        'orders', 'customers', 'products', 'materials', 
        'materialRequests', 'branches', 'users', 'recipients',
        'expenses', 'budgets', 'partners'
      ];
      
      const backupData: any = {};
      
      for (const collectionName of collections) {
        const snapshot = await db.collection(collectionName).get();
        backupData[collectionName] = snapshot.docs.map(doc => ({
          id: doc.id,
          data: doc.data()
        }));
      }
      
      // 백업 데이터를 Firestore에 저장
      await db.collection('backups').add({
        timestamp: timestamp,
        data: backupData,
        type: 'auto',
        status: 'completed'
      });
      
      console.log('자동 백업 완료:', timestamp.toDate());
      return null;
    } catch (error) {
      console.error('자동 백업 실패:', error);
      return null;
    }
  });

// 수동 백업 함수
export const manualBackup = functions.https.onCall(async (data, context) => {
  try {
    // 권한 확인
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', '인증이 필요합니다.');
    }
    
    const db = admin.firestore();
    const timestamp = admin.firestore.Timestamp.now();
    
    // 백업할 컬렉션들
    const collections = [
      'orders', 'customers', 'products', 'materials', 
      'materialRequests', 'branches', 'users', 'recipients',
      'expenses', 'budgets', 'partners'
    ];
    
    const backupData: any = {};
    
    for (const collectionName of collections) {
      const snapshot = await db.collection(collectionName).get();
      backupData[collectionName] = snapshot.docs.map(doc => ({
        id: doc.id,
        data: doc.data()
      }));
    }
    
    // 백업 데이터를 Firestore에 저장
    const backupRef = await db.collection('backups').add({
      timestamp: timestamp,
      data: backupData,
      type: 'manual',
      createdBy: context.auth.uid,
      status: 'completed'
    });
    
    return {
      success: true,
      backupId: backupRef.id,
      timestamp: timestamp.toDate()
    };
  } catch (error) {
    console.error('수동 백업 실패:', error);
    throw new functions.https.HttpsError('internal', '백업 중 오류가 발생했습니다.');
  }
});

import * as nodemailer from 'nodemailer';

// Nodemailer transporter 설정 (실제 환경에서는 환경 변수 사용 권장)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'YOUR_EMAIL@gmail.com', // 여기에 실제 이메일 주소 입력
    pass: 'YOUR_PASSWORD'       // 여기에 실제 앱 비밀번호 또는 계정 비밀번호 입력
  }
});

// 인사 서류 제출 시 이메일 발송 함수
export const onHrDocumentCreate = functions.firestore
  .document('hr_documents/{docId}')
  .onCreate(async (snap, context) => {
    const docData = snap.data();
    if (!docData) {
      console.error('No document data found');
      return;
    }

    const { userName, documentType, contents, fileUrl, submissionDate } = docData;
    const toEmail = 'ADMIN_EMAIL@example.com'; // 알림을 받을 관리자 이메일

    let subject = `[인사 서류] ${userName}님이 ${documentType}를 제출했습니다.`;
    let text = `${userName}님이 ${documentType}를 제출했습니다.\n\n제출일: ${submissionDate.toDate().toLocaleString('ko-KR')}`;
    let attachments = [];

    if (fileUrl) {
      // 파일 업로드의 경우
      text += `\n\n작성된 파일이 첨부되었습니다.`;
      attachments.push({ 
        filename: `${userName}_${documentType}.pdf`, // 파일명은 적절히 변경 가능
        path: fileUrl 
      });
    } else if (contents) {
      // 온라인 작성의 경우
      text += `\n\n[신청 내용]`;
      if (contents.startDate) {
        text += `\n- 휴직 시작일: ${contents.startDate.toDate().toLocaleDateString('ko-KR')}`;
      }
      if (contents.endDate) {
        text += `\n- 휴직 종료일: ${contents.endDate.toDate().toLocaleDateString('ko-KR')}`;
      }
      text += `\n- 사유: ${contents.reason}`;
    }

    const mailOptions = {
      from: 'YOUR_EMAIL@gmail.com', // 보내는 사람 이메일
      to: toEmail,
      subject: subject,
      text: text,
      attachments: attachments
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`Email sent to ${toEmail} for document ${snap.id}`);
    } catch (error) {
      console.error('Error sending email:', error);
    }
  });

// 백업 복원 함수
export const restoreBackup = functions.https.onCall(async (data, context) => {
  try {
    // 권한 확인
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', '인증이 필요합니다.');
    }
    
    const { backupId } = data;
    if (!backupId) {
      throw new functions.https.HttpsError('invalid-argument', '백업 ID가 필요합니다.');
    }
    
    const db = admin.firestore();
    
    // 백업 데이터 조회
    const backupDoc = await db.collection('backups').doc(backupId).get();
    if (!backupDoc.exists) {
      throw new functions.https.HttpsError('not-found', '백업을 찾을 수 없습니다.');
    }
    
    const backupData = backupDoc.data()?.data;
    if (!backupData) {
      throw new functions.https.HttpsError('internal', '백업 데이터가 없습니다.');
    }
    
    // 데이터 복원
    const batch = db.batch();
    
    for (const [collectionName, documents] of Object.entries(backupData)) {
      for (const docData of documents as any[]) {
        const docRef = db.collection(collectionName).doc(docData.id);
        batch.set(docRef, docData.data);
      }
    }
    
    await batch.commit();
    
    return {
      success: true,
      message: '백업 복원이 완료되었습니다.'
    };
  } catch (error) {
    console.error('백업 복원 실패:', error);
    throw new functions.https.HttpsError('internal', '백업 복원 중 오류가 발생했습니다.');
  }
});
