import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDu6Mub2yng8JFWfYtqfnDQ3phR6EAOtjU",
  authDomain: "laboratorio1clinico1proyectos1.firebaseapp.com",
  projectId: "laboratorio1clinico1proyectos1",
  storageBucket: "laboratorio1clinico1proyectos1.firebasestorage.app",
  messagingSenderId: "37714405790",
  appId: "1:37714405790:web:a28e9a8fe09e33dfd1ce8f",
};

const app =
  getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApp();

const auth = getAuth(app);

const db = getFirestore(app);

export { app, auth, db };