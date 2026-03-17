import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyAxHZsMAGr28xkmC9ZYJLkFqwSMO0RIfGg',
  authDomain: 'nurtra-75777.firebaseapp.com',
  projectId: 'nurtra-75777',
  storageBucket: 'nurtra-75777.firebasestorage.app',
  messagingSenderId: '420916737489',
}

export const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
