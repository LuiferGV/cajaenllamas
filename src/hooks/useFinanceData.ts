import { useEffect, useState } from "react";
import { EMPTY_STATE } from "../lib/finance";
import { hasRealtimeDatabaseConfig, saveFinanceStateRemote, subscribeFinanceState } from "../lib/firebase";
import { loadFinanceState, saveFinanceState } from "../lib/storage";
import type { FinanceState } from "../types";

type DataSource = "local" | "firebase";
type FirebaseState = "not-configured" | "idle" | "loading" | "connected" | "saving" | "error";

interface FinanceDataState {
  financeState: FinanceState;
  dataSource: DataSource;
  firebaseState: FirebaseState;
  persistState: (nextState: FinanceState, rollbackState?: FinanceState) => Promise<void>;
}

export function useFinanceData(enabled: boolean, userId: string | null): FinanceDataState {
  const hasDatabaseConfig = hasRealtimeDatabaseConfig();
  const [financeState, setFinanceState] = useState<FinanceState>(hasDatabaseConfig ? EMPTY_STATE : loadFinanceState());
  const [dataSource, setDataSource] = useState<DataSource>(hasDatabaseConfig ? "firebase" : "local");
  const [firebaseState, setFirebaseState] = useState<FirebaseState>(
    hasDatabaseConfig ? (enabled ? "loading" : "idle") : "not-configured"
  );

  useEffect(() => {
    if (!hasDatabaseConfig) {
      const localState = loadFinanceState();
      setFinanceState(localState);
      setDataSource("local");
      setFirebaseState("not-configured");
      return undefined;
    }

    if (!enabled || !userId) {
      setFinanceState(EMPTY_STATE);
      setDataSource("firebase");
      setFirebaseState("idle");
      return undefined;
    }

    setFirebaseState("loading");

    const unsubscribe = subscribeFinanceState(
      userId,
      (nextFinanceState) => {
        setFinanceState(nextFinanceState);
        saveFinanceState(nextFinanceState);
        setDataSource("firebase");
        setFirebaseState("connected");
      },
      (error) => {
        console.error("No se pudo conectar con Firebase", error);
        setFirebaseState("error");
      }
    );

    return unsubscribe;
  }, [enabled, hasDatabaseConfig, userId]);

  const persistState = async (nextState: FinanceState, rollbackState?: FinanceState) => {
    setFinanceState(nextState);
    saveFinanceState(nextState);

    if (!hasDatabaseConfig || !enabled || !userId) {
      setFirebaseState(hasDatabaseConfig ? "idle" : "not-configured");
      return;
    }

    setFirebaseState("saving");

    try {
      await saveFinanceStateRemote(userId, nextState);
      setFirebaseState("connected");
    } catch (error) {
      if (rollbackState) {
        setFinanceState(rollbackState);
        saveFinanceState(rollbackState);
      }

      setFirebaseState("error");
      throw error;
    }
  };

  return {
    financeState,
    dataSource,
    firebaseState,
    persistState
  };
}
