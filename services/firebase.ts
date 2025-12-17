import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD5230yNYk6WneHum7z-HJH5mnqto_t1AM",
  authDomain: "biometric-attendace-a4bfe.firebaseapp.com",
  projectId: "biometric-attendace-a4bfe",
  storageBucket: "biometric-attendace-a4bfe.firebasestorage.app",
  messagingSenderId: "17500864277",
  appId: "1:17500864277:web:fa2e70843ff97d152bf31c",
  measurementId: "G-6Y38QMXG0V"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

// export default app;

// const firebaseConfig = {
//   apiKey: "AIzaSyD5230yNYk6WneHum7z-HJH5mnqto_t1AM",
//   authDomain: "biometric-attendace-a4bfe.firebaseapp.com",
//   projectId: "biometric-attendace-a4bfe",
//   storageBucket: "biometric-attendace-a4bfe.firebasestorage.app",
//   messagingSenderId: "17500864277",
//   appId: "1:17500864277:web:fa2e70843ff97d152bf31c",
//   measurementId: "G-6Y38QMXG0V",
// };

// // Initialize Firebase
// const app = initializeApp(firebaseConfig);

// export const auth = getAuth(app);
// export const db = getFirestore(app);

// export default app;
