import { useState, useEffect, useCallback } from 'react';
import type { PurchasesOfferings, PurchasesPackage, CustomerInfo } from 'react-native-purchases';
import Purchases from 'react-native-purchases';
import {
  getOfferings,
  purchasePackage,
  restorePurchases,
  getCustomerInfo,
  getPlanFromCustomerInfo,
  type PlanTier,
} from '../services/purchaseService';

interface PurchaseState {
  plan: PlanTier;
  isActive: boolean;
  offerings: PurchasesOfferings | null;
  loading: boolean;
  error: string | null;
}

export function usePurchases() {
  const [state, setState] = useState<PurchaseState>({
    plan: 'explorer',
    isActive: false,
    offerings: null,
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    try {
      const [info, offerings] = await Promise.all([
        getCustomerInfo(),
        getOfferings(),
      ]);
      const plan = getPlanFromCustomerInfo(info);
      setState({
        plan,
        isActive: plan !== 'explorer',
        offerings,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err?.message ?? 'Failed to load purchases',
      }));
    }
  }, []);

  useEffect(() => {
    refresh();

    const listener = (info: CustomerInfo) => {
      const plan = getPlanFromCustomerInfo(info);
      setState((prev) => ({
        ...prev,
        plan,
        isActive: plan !== 'explorer',
      }));
    };
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => { Purchases.removeCustomerInfoUpdateListener(listener); };
  }, [refresh]);

  const purchase = useCallback(async (pkg: PurchasesPackage) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const info = await purchasePackage(pkg);
      const plan = getPlanFromCustomerInfo(info);
      setState((prev) => ({
        ...prev,
        plan,
        isActive: plan !== 'explorer',
        loading: false,
      }));
      return info;
    } catch (err: any) {
      const userCancelled = err?.userCancelled;
      setState((prev) => ({
        ...prev,
        loading: false,
        error: userCancelled ? null : (err?.message ?? 'Purchase failed'),
      }));
      return null;
    }
  }, []);

  const restore = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const info = await restorePurchases();
      const plan = getPlanFromCustomerInfo(info);
      setState((prev) => ({
        ...prev,
        plan,
        isActive: plan !== 'explorer',
        loading: false,
      }));
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err?.message ?? 'Restore failed',
      }));
    }
  }, []);

  return { ...state, purchase, restore, refresh };
}
