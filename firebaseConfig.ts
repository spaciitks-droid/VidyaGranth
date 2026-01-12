// firebaseConfig.ts
import { initializeApp, getApp, getApps } from 'firebase/app';

// 1. We import 'Auth' type to fix the implicit 'any' error
// 2. We keep @ts-ignore to handle the missing persistence definition
// @ts-ignore 
import { initializeAuth, getReactNativePersistence, getAuth, Auth } from 'firebase/auth';

import { getFirestore } from 'firebase/firestore';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyAQeCaAOHrzlZsbdLPxG9hyxyppTpbq8PM",
  authDomain: "nitgyanamlibrary.firebaseapp.com",
  projectId: "nitgyanamlibrary",
  storageBucket: "nitgyanamlibrary.firebasestorage.app",
  messagingSenderId: "875644403468",
  appId: "1:875644403468:web:9b6ac35af5749214ddd329"
};

// PREVENT RE-INITIALIZATION OF APP
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// PREVENT RE-INITIALIZATION OF AUTH & FIX VARIABLE TYPE
let auth: Auth; // <--- This specific type declaration fixes the 20 errors you see

try {
  // First, try to initialize with React Native persistence
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
  });
} catch (error: any) {
  // If it's already initialized (hot reload), just grab the existing instance
  if (error.code === 'auth/already-initialized') {
    auth = getAuth(app);
  } else {
    console.error("Firebase Auth Error:", error);
    throw error;
  }
}

export { auth };
export const db = getFirestore(app);