import { getApp, getApps, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User
} from "firebase/auth";
import { equalTo, get, getDatabase, onValue, orderByChild, query, ref, remove, set, update } from "firebase/database";
import type { FinanceState, SharedLoan } from "../types";
import { EMPTY_STATE } from "./finance";
import { normalizeFinanceState } from "./storage";
import { normalizeSharedLoan, sortSharedLoans } from "./sharedLoans";

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

function encodeEmailKey(email: string) {
  return encodeURIComponent(email.trim().toLowerCase());
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

export async function ensureUserDirectoryEntry(userId: string, email: string | null) {
  if (!email) return;

  const database = ensureDatabase();
  const normalizedEmail = email.trim().toLowerCase();

  await update(ref(database), {
    [`userProfiles/${userId}`]: {
      uid: userId,
      email: normalizedEmail,
      updatedAt: Date.now()
    },
    [`emailDirectory/${encodeEmailKey(normalizedEmail)}`]: {
      uid: userId,
      email: normalizedEmail,
      updatedAt: Date.now()
    }
  });
}

export async function resolveUserByEmail(email: string) {
  const database = ensureDatabase();
  const snapshot = await get(ref(database, `emailDirectory/${encodeEmailKey(email)}`));
  const value = snapshot.val() as { uid?: string; email?: string } | null;
  if (!value?.uid || !value?.email) return null;
  return {
    uid: value.uid,
    email: value.email
  };
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

export function subscribeSharedLoans(
  userEmail: string,
  onChange: (sharedLoans: SharedLoan[]) => void,
  onError?: (error: Error) => void
) {
  const database = ensureDatabase();
  const normalizedEmail = userEmail.trim().toLowerCase();
  const lenderLoansQuery = query(ref(database, "sharedLoans"), orderByChild("lenderEmail"), equalTo(normalizedEmail));
  const borrowerLoansQuery = query(ref(database, "sharedLoans"), orderByChild("borrowerEmail"), equalTo(normalizedEmail));
  const loanMap = new Map<string, SharedLoan>();

  const emit = () => {
    onChange(Array.from(loanMap.values()).sort(sortSharedLoans));
  };

  const rebuildFromSnapshots = (
    lenderSnapshot: Record<string, Partial<SharedLoan>> | null,
    borrowerSnapshot: Record<string, Partial<SharedLoan>> | null
  ) => {
    loanMap.clear();

    for (const [loanId, rawValue] of Object.entries(lenderSnapshot ?? {})) {
      loanMap.set(loanId, normalizeSharedLoan({ ...rawValue, id: loanId }));
    }

    for (const [loanId, rawValue] of Object.entries(borrowerSnapshot ?? {})) {
      if (!loanMap.has(loanId)) {
        loanMap.set(loanId, normalizeSharedLoan({ ...rawValue, id: loanId }));
      }
    }

    emit();
  };

  let lenderSnapshot: Record<string, Partial<SharedLoan>> | null = null;
  let borrowerSnapshot: Record<string, Partial<SharedLoan>> | null = null;

  const lenderUnsubscribe = onValue(
    lenderLoansQuery,
    (snapshot) => {
      lenderSnapshot = (snapshot.val() as Record<string, Partial<SharedLoan>> | null) ?? null;
      rebuildFromSnapshots(lenderSnapshot, borrowerSnapshot);
    },
    (error) => onError?.(error)
  );

  const borrowerUnsubscribe = onValue(
    borrowerLoansQuery,
    (snapshot) => {
      borrowerSnapshot = (snapshot.val() as Record<string, Partial<SharedLoan>> | null) ?? null;
      rebuildFromSnapshots(lenderSnapshot, borrowerSnapshot);
    },
    (error) => onError?.(error)
  );

  return () => {
    lenderUnsubscribe();
    borrowerUnsubscribe();
    loanMap.clear();
  };
}

export async function saveSharedLoanRemote(sharedLoan: SharedLoan) {
  const database = ensureDatabase();
  await set(ref(database, `sharedLoans/${sharedLoan.id}`), sharedLoan);
}

export async function deleteSharedLoanRemote(sharedLoan: SharedLoan) {
  const database = ensureDatabase();
  await remove(ref(database, `sharedLoans/${sharedLoan.id}`));
}
