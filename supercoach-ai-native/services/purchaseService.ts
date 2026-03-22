import Purchases, {
  type PurchasesOfferings,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';

export type PlanTier = 'explorer' | 'essential' | 'visionary' | 'master';

const ENTITLEMENT_MAP: Record<string, PlanTier> = {
  essential: 'essential',
  visionary: 'visionary',
  master: 'master',
};

export async function identifyUser(uid: string): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.logIn(uid);
  return customerInfo;
}

export async function logOutPurchases(): Promise<void> {
  await Purchases.logOut();
}

export async function getOfferings(): Promise<PurchasesOfferings> {
  return Purchases.getOfferings();
}

export async function purchasePackage(
  pkg: PurchasesPackage,
): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export async function restorePurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}

export async function getCustomerInfo(): Promise<CustomerInfo> {
  return Purchases.getCustomerInfo();
}

export function getPlanFromCustomerInfo(info: CustomerInfo): PlanTier {
  for (const [entitlementId, plan] of Object.entries(ENTITLEMENT_MAP)) {
    if (info.entitlements.active[entitlementId]?.isActive) {
      return plan;
    }
  }
  return 'explorer';
}
