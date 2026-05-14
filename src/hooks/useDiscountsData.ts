import { useEffect, useRef, useState } from "react";
import {
  deleteDiscountRemote,
  deleteExpiredDiscountsRemote,
  hasRealtimeDatabaseConfig,
  saveDiscountRemote,
  subscribeDiscounts
} from "../lib/firebase";
import { isDiscountExpired, sortDiscounts } from "../lib/discounts";
import { todayKey } from "../lib/finance";
import type { DiscountItem } from "../types";

type DiscountsState = "not-configured" | "idle" | "loading" | "connected" | "saving" | "error";

interface DiscountsDataState {
  discounts: DiscountItem[];
  discountsState: DiscountsState;
  discountsError: string | null;
  saveDiscount: (discount: DiscountItem) => Promise<boolean>;
  deleteDiscount: (discountId: string) => Promise<boolean>;
}

export function useDiscountsData(enabled: boolean): DiscountsDataState {
  const hasDatabaseConfig = hasRealtimeDatabaseConfig();
  const [discounts, setDiscounts] = useState<DiscountItem[]>([]);
  const [discountsState, setDiscountsState] = useState<DiscountsState>(hasDatabaseConfig ? (enabled ? "loading" : "idle") : "not-configured");
  const [discountsError, setDiscountsError] = useState<string | null>(null);
  const cleaningIdsRef = useRef<Set<string>>(new Set());

  const cleanupExpiredDiscounts = async (expiredDiscounts: DiscountItem[]) => {
    if (!hasDatabaseConfig || !enabled || expiredDiscounts.length === 0) return;

    const currentDay = todayKey();
    const expiredIds = expiredDiscounts
      .filter((discount) => isDiscountExpired(discount, currentDay))
      .map((discount) => discount.id)
      .filter((discountId) => !cleaningIdsRef.current.has(discountId));

    if (expiredIds.length === 0) return;

    expiredIds.forEach((discountId) => cleaningIdsRef.current.add(discountId));
    setDiscounts((current) => current.filter((discount) => !expiredIds.includes(discount.id)));

    try {
      await deleteExpiredDiscountsRemote(expiredIds);
    } catch (error) {
      console.error("No se pudieron limpiar los descuentos vencidos", error);
    } finally {
      expiredIds.forEach((discountId) => cleaningIdsRef.current.delete(discountId));
    }
  };

  useEffect(() => {
    if (!hasDatabaseConfig) {
      setDiscounts([]);
      setDiscountsState("not-configured");
      setDiscountsError(null);
      return undefined;
    }

    if (!enabled) {
      setDiscounts([]);
      setDiscountsState("idle");
      setDiscountsError(null);
      return undefined;
    }

    setDiscountsState("loading");
    setDiscountsError(null);

    const unsubscribe = subscribeDiscounts(
      (nextDiscounts) => {
        const currentDay = todayKey();
        const activeDiscounts = nextDiscounts.filter((discount) => !isDiscountExpired(discount, currentDay));
        const expiredDiscounts = nextDiscounts.filter((discount) => isDiscountExpired(discount, currentDay));

        setDiscounts(activeDiscounts);
        setDiscountsState("connected");
        setDiscountsError(null);

        if (expiredDiscounts.length > 0) {
          void cleanupExpiredDiscounts(expiredDiscounts);
        }
      },
      (error) => {
        console.error("No se pudieron cargar los descuentos", error);
        setDiscountsState("error");
        setDiscountsError("No se pudieron cargar los descuentos.");
      }
    );

    return unsubscribe;
  }, [enabled, hasDatabaseConfig]);

  useEffect(() => {
    if (!enabled || discounts.length === 0) return undefined;

    const intervalId = window.setInterval(() => {
      const currentDay = todayKey();
      const expiredDiscounts = discounts.filter((discount) => isDiscountExpired(discount, currentDay));

      if (expiredDiscounts.length > 0) {
        void cleanupExpiredDiscounts(expiredDiscounts);
      }
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, [discounts, enabled]);

  const saveDiscount = async (discount: DiscountItem) => {
    const previousDiscounts = discounts;
    const nextDiscounts = [...discounts.filter((entry) => entry.id !== discount.id), discount]
      .filter((entry) => !isDiscountExpired(entry))
      .sort(sortDiscounts);
    setDiscounts(nextDiscounts);

    if (!hasDatabaseConfig || !enabled) {
      setDiscountsState(hasDatabaseConfig ? "idle" : "not-configured");
      return false;
    }

    setDiscountsState("saving");
    setDiscountsError(null);

    try {
      await saveDiscountRemote(discount);
      setDiscountsState("connected");
      return true;
    } catch (error) {
      console.error("No se pudo guardar el descuento", error);
      setDiscounts(previousDiscounts);
      setDiscountsState("error");
      setDiscountsError("No se pudo guardar el descuento.");
      return false;
    }
  };

  const deleteDiscount = async (discountId: string) => {
    const previousDiscounts = discounts;
    setDiscounts((current) => current.filter((entry) => entry.id !== discountId));

    if (!hasDatabaseConfig || !enabled) {
      setDiscountsState(hasDatabaseConfig ? "idle" : "not-configured");
      return false;
    }

    setDiscountsState("saving");
    setDiscountsError(null);

    try {
      await deleteDiscountRemote(discountId);
      setDiscountsState("connected");
      return true;
    } catch (error) {
      console.error("No se pudo borrar el descuento", error);
      setDiscounts(previousDiscounts);
      setDiscountsState("error");
      setDiscountsError("No se pudo borrar el descuento.");
      return false;
    }
  };

  return {
    discounts,
    discountsState,
    discountsError,
    saveDiscount,
    deleteDiscount
  };
}
