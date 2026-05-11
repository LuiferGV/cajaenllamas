import { useEffect, useState } from "react";
import { deleteSharedLoanRemote, hasRealtimeDatabaseConfig, saveSharedLoanRemote, subscribeSharedLoans } from "../lib/firebase";
import { sortSharedLoans } from "../lib/sharedLoans";
import type { SharedLoan } from "../types";

type SharedLoansState = "not-configured" | "idle" | "loading" | "connected" | "saving" | "error";

interface SharedLoansDataState {
  sharedLoans: SharedLoan[];
  sharedLoansState: SharedLoansState;
  sharedLoansError: string | null;
  saveSharedLoan: (sharedLoan: SharedLoan) => Promise<boolean>;
  deleteSharedLoan: (sharedLoan: SharedLoan) => Promise<boolean>;
}

export function useSharedLoansData(enabled: boolean, userId: string | null): SharedLoansDataState {
  const hasDatabaseConfig = hasRealtimeDatabaseConfig();
  const [sharedLoans, setSharedLoans] = useState<SharedLoan[]>([]);
  const [sharedLoansState, setSharedLoansState] = useState<SharedLoansState>(
    hasDatabaseConfig ? (enabled ? "loading" : "idle") : "not-configured"
  );
  const [sharedLoansError, setSharedLoansError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasDatabaseConfig) {
      setSharedLoans([]);
      setSharedLoansState("not-configured");
      setSharedLoansError(null);
      return undefined;
    }

    if (!enabled || !userId) {
      setSharedLoans([]);
      setSharedLoansState("idle");
      setSharedLoansError(null);
      return undefined;
    }

    setSharedLoansState("loading");
    setSharedLoansError(null);

    const unsubscribe = subscribeSharedLoans(
      userId,
      (nextSharedLoans) => {
        setSharedLoans(nextSharedLoans);
        setSharedLoansState("connected");
        setSharedLoansError(null);
      },
      (error) => {
        console.error("No se pudieron cargar los prestamos compartidos", error);
        setSharedLoansState("error");
        setSharedLoansError("No se pudieron cargar los prestamos compartidos.");
      }
    );

    return unsubscribe;
  }, [enabled, hasDatabaseConfig, userId]);

  const saveSharedLoan = async (sharedLoan: SharedLoan) => {
    const previousLoans = sharedLoans;
    const nextLoans = [...sharedLoans.filter((entry) => entry.id !== sharedLoan.id), sharedLoan].sort(sortSharedLoans);
    setSharedLoans(nextLoans);

    if (!hasDatabaseConfig || !enabled || !userId) {
      setSharedLoansState(hasDatabaseConfig ? "idle" : "not-configured");
      return false;
    }

    setSharedLoansState("saving");
    setSharedLoansError(null);

    try {
      await saveSharedLoanRemote(sharedLoan);
      setSharedLoansState("connected");
      return true;
    } catch (error) {
      console.error("No se pudo guardar el prestamo compartido", error);
      setSharedLoans(previousLoans);
      setSharedLoansState("error");
      setSharedLoansError("No se pudo guardar el prestamo compartido.");
      return false;
    }
  };

  const deleteSharedLoan = async (sharedLoan: SharedLoan) => {
    const previousLoans = sharedLoans;
    setSharedLoans((current) => current.filter((entry) => entry.id !== sharedLoan.id));

    if (!hasDatabaseConfig || !enabled || !userId) {
      setSharedLoansState(hasDatabaseConfig ? "idle" : "not-configured");
      return false;
    }

    setSharedLoansState("saving");
    setSharedLoansError(null);

    try {
      await deleteSharedLoanRemote(sharedLoan);
      setSharedLoansState("connected");
      return true;
    } catch (error) {
      console.error("No se pudo borrar el prestamo compartido", error);
      setSharedLoans(previousLoans);
      setSharedLoansState("error");
      setSharedLoansError("No se pudo borrar el prestamo compartido.");
      return false;
    }
  };

  return {
    sharedLoans,
    sharedLoansState,
    sharedLoansError,
    saveSharedLoan,
    deleteSharedLoan
  };
}
