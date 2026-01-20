import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  getFirestore,
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  CACHE_SIZE_UNLIMITED
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

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

// Initialize Firebase
let app;
let auth;
let storage;
let db;

// Firebase 초기화 함수
const initializeFirebase = () => {
  try {
    // 앱이 이미 초기화되었는지 확인
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);

      // Auth 초기화
      auth = getAuth(app);
      // Storage 초기화
      storage = getStorage(app);

      // Firestore 초기화 - 최신 SDK 방식
      try {
        const isDev = process.env.NODE_ENV === 'development';
        db = initializeFirestore(app, {
          localCache: isDev
            ? memoryLocalCache()
            : persistentLocalCache({
              tabManager: persistentMultipleTabManager(),
            }),
          experimentalForceLongPolling: true,
          ignoreUndefinedProperties: true,
        });
      } catch (error) {
        console.warn('Firestore initialization failed, falling back to default:', error);
        db = getFirestore(app);
      }

    } else {
      app = getApp();
      auth = getAuth(app);
      storage = getStorage(app);
      // 이미 초기화된 경우 getFirestore 사용 (재초기화 방지)
      db = getFirestore(app);
    }

    // 개발 환경에서 에뮬레이터 연결 (선택사항)
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      // 에뮬레이터가 실행 중인지 확인 후 연결
      // connectFirestoreEmulator(db, 'localhost', 8080);
    }

    return { app, auth, db, storage };

  } catch (error) {
    console.error('Firebase initialization error:', error);
    throw error;
  }
};

// 초기화 실행 - 서버사이드 렌더링 고려
let firebaseInstance: any = null;

if (typeof window !== 'undefined') {
  // 클라이언트 사이드에서만 초기화
  try {
    firebaseInstance = initializeFirebase();
    app = firebaseInstance.app;
    auth = firebaseInstance.auth;
    db = firebaseInstance.db;
    storage = firebaseInstance.storage;
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    // 오류가 발생해도 앱이 계속 실행되도록 함
  }
}

export { app, auth, db, storage };
