import {
  getApp,
  getApps,
  initializeApp,
} from "firebase/app";

import {
  getAuth,
  initializeAuth,
  type Auth,
} from "firebase/auth";

import * as FirebaseAuth from "firebase/auth";

import {
  getFirestore,
} from "firebase/firestore";

import {
  Platform,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

export const firebaseConfig = {
  apiKey:
    "AIzaSyDu6Mub2yng8JFWfYtqfnDQ3phR6EAOtjU",

  authDomain:
    "laboratorio1clinico1proyectos1.firebaseapp.com",

  projectId:
    "laboratorio1clinico1proyectos1",

  storageBucket:
    "laboratorio1clinico1proyectos1.firebasestorage.app",

  messagingSenderId:
    "37714405790",

  appId:
    "1:37714405790:web:a28e9a8fe09e33dfd1ce8f",
};

const app =
  getApps().length > 0
    ? getApp()
    : initializeApp(
        firebaseConfig
      );

let auth: Auth;

if (Platform.OS === "web") {

  // =========================================
  // WEB
  // =========================================

  auth = getAuth(app);

} else {

  // =========================================
  // ANDROID / IOS
  // =========================================

  try {

    const getReactNativePersistence =
      (
        FirebaseAuth as any
      ).getReactNativePersistence;

    auth = initializeAuth(
      app,
      {
        persistence:
          getReactNativePersistence(
            AsyncStorage
          ),
      }
    );

  } catch (error) {

    /*
      Expo Fast Refresh puede intentar
      inicializar Firebase Auth más de una vez.

      En ese caso recuperamos la instancia
      que ya existe.
    */

    auth = getAuth(app);
  }
}

const db =
  getFirestore(app);

export {
  app,
  auth,
  db,
};