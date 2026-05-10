import { getApp, getApps, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User
} from "firebase/auth";
import { getDatabase, onValue, ref, set } from "firebase/database";
import type { FinanceState } from "../types";
import { EMPTY_STATE } from "./finance";
import { normalizeFinanceState } from "./storage";

const firebaseConfig = {
  apiKey: "AIzaSyDWeXUGGqkKZ6qRjGtlwN9lNdNTmZKVAcw",
  authDomain: "financial-1e138.firebaseapp.com",
  databaseURL: "https://financial-1e138-default-rtdb.firebaseio.com/",
  projectId: "financial-1e138",
  storageBucket: "financial-1e138.firebasestorage.app",
  messagingSenderId: "289976406927",
  appId: "1:289976406927:web:dbfdc241ee532285eff1fa"
};

const coreRequiredKeys = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.storageBucket,
  firebaseConfig.messagingSenderId,
  firebaseConfig.appId
];

const databaseRequiredKeys = [...coreRequiredKeys, firebaseConfig.databaseURL];

export function hasFirebaseCoreConfig(): boolean {
  return coreRequiredKeys.every(Boolean);
}

export function hasRealtimeDatabaseConfig(): boolean {
  return databaseRequiredKeys.every(Boolean);
}

function ensureApp() {
  if (!hasFirebaseCoreConfig()) {
    throw new Error("Falta la configuracion base de Firebase.");
  }

  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

let authInstance: ReturnType<typeof getAuth> | null = null;
let databaseInstance: ReturnType<typeof getDatabase> | null = null;

function ensureAuth() {
  if (!authInstance) {
    authInstance = getAuth(ensureApp());
  }

  return authInstance;
}

function ensureDatabase() {
  if (!hasRealtimeDatabaseConfig()) {
    throw new Error("Falta databaseURL para conectar Realtime Database.");
  }

  if (!databaseInstance) {
    databaseInstance = getDatabase(ensureApp());
  }

  return databaseInstance;
}

export function subscribeAuth(
  onChange: (user: User | null) => void,
  onError?: (error: Error) => void
) {
  const auth = ensureAuth();
  return onAuthStateChanged(auth, onChange, onError);
}

export async function signIn(email: string, password: string) {
  const auth = ensureAuth();
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signUp(email: string, password: string) {
  const auth = ensureAuth();
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signOutSession() {
  const auth = ensureAuth();
  return signOut(auth);
}

export function subscribeFinanceState(
  userId: string,
  onChange: (financeState: FinanceState) => void,
  onError?: (error: Error) => void
) {
  const database = ensureDatabase();
  const financesRef = ref(database, `finances/users/${userId}`);

  return onValue(
    financesRef,
    (snapshot) => {
      const value = snapshot.val();
      onChange(value ? normalizeFinanceState(value as Partial<FinanceState>) : EMPTY_STATE);
    },
    (error) => onError?.(error)
  );
}

export async function saveFinanceStateRemote(userId: string, financeState: FinanceState) {
  const database = ensureDatabase();
  await set(ref(database, `finances/users/${userId}`), financeState);
}
