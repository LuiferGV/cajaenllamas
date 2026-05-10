import { useEffect, useState } from "react";
import { hasFirebaseCoreConfig, signIn, signOutSession, signUp, subscribeAuth } from "../lib/firebase";

export type AuthMode = "login" | "register";

export type SessionState = "not-configured" | "loading" | "signed-out" | "authenticated" | "error";

interface FirebaseSessionState {
  sessionState: SessionState;
  userEmail: string | null;
  userId: string | null;
  authError: string | null;
  isSubmitting: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

function getAuthErrorMessage(error: unknown, mode: AuthMode) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";

  if (code === "auth/invalid-email") return "El email no tiene un formato valido.";
  if (code === "auth/invalid-credential") return "El email o la contrasena no coinciden.";
  if (code === "auth/email-already-in-use") return "Ese email ya esta registrado en Firebase.";
  if (code === "auth/weak-password") return "La contrasena es demasiado debil. Usa al menos 6 caracteres.";
  if (code === "auth/operation-not-allowed") return "El registro con email y contrasena no esta habilitado en Firebase Auth.";
  if (code === "auth/user-disabled") return "Este usuario fue deshabilitado en Firebase.";
  if (code === "auth/too-many-requests") return "Hay demasiados intentos. Espera un momento y prueba otra vez.";
  return mode === "register"
    ? "No se pudo crear la cuenta. Revisa el email, la contrasena y la configuracion de Firebase."
    : "No se pudo iniciar sesion. Revisa el email, la contrasena y la configuracion de Firebase.";
}

export function useFirebaseSession(): FirebaseSessionState {
  const [sessionState, setSessionState] = useState<SessionState>(
    hasFirebaseCoreConfig() ? "loading" : "not-configured"
  );
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!hasFirebaseCoreConfig()) return undefined;

    setSessionState("loading");

    const unsubscribe = subscribeAuth(
      (user) => {
        setUserEmail(user?.email ?? null);
        setUserId(user?.uid ?? null);
        setSessionState(user ? "authenticated" : "signed-out");
        setAuthError(null);
      },
      (error) => {
        console.error("No se pudo validar la sesion de Firebase", error);
        setSessionState("error");
        setAuthError("No se pudo validar la sesion con Firebase.");
      }
    );

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    setIsSubmitting(true);
    setAuthError(null);

    try {
      await signIn(email, password);
      return true;
    } catch (error) {
      console.error("Error al iniciar sesion", error);
      setSessionState("signed-out");
      setAuthError(getAuthErrorMessage(error, "login"));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const register = async (email: string, password: string) => {
    setIsSubmitting(true);
    setAuthError(null);

    try {
      await signUp(email, password);
      return true;
    } catch (error) {
      console.error("Error al crear la cuenta", error);
      setSessionState("signed-out");
      setAuthError(getAuthErrorMessage(error, "register"));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const logout = async () => {
    setIsSubmitting(true);
    setAuthError(null);

    try {
      await signOutSession();
    } catch (error) {
      console.error("Error al cerrar sesion", error);
      setSessionState("error");
      setAuthError("No se pudo cerrar la sesion.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    sessionState,
    userEmail,
    userId,
    authError,
    isSubmitting,
    login,
    register,
    logout
  };
}
