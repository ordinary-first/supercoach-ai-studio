# Secret Coach AI — Native App Release v1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the existing React Native (Expo 52) app to iOS and Android as "Secret Coach AI" with core features and RevenueCat in-app subscriptions.

**Architecture:** Expo EAS Build for both platforms. RevenueCat SDK handles unified iOS/Android subscriptions, syncing entitlements to Firestore via webhook. Existing Vercel API endpoints serve chat, feedback, and goal decomposition.

**Tech Stack:** Expo 52, React Native 0.76, RevenueCat (`react-native-purchases`), Firebase Auth/Firestore, EAS Build/Submit, NativeWind/Tailwind

**Spec:** `docs/superpowers/specs/2026-03-23-secret-coach-native-release-design.md`

---

## File Structure

### New Files
- `supercoach-ai-native/eas.json` — EAS Build configuration
- `supercoach-ai-native/services/purchaseService.ts` — RevenueCat init, offerings, purchase, restore
- `supercoach-ai-native/hooks/usePurchases.ts` — entitlement state hook
- `supercoach-ai-native/app/(tabs)/visualize.tsx` — placeholder "Coming Soon" screen
- `supercoach-ai-native/assets/icon.png` — 1024x1024 app icon
- `supercoach-ai-native/assets/adaptive-icon.png` — 1024x1024 Android adaptive icon
- `supercoach-ai-native/assets/splash-icon.png` — splash screen logo
- `supercoach-ai-native/assets/favicon.png` — 196x196 web favicon
- `api/revenuecat-webhook.ts` — RevenueCat webhook -> Firestore sync

### Modified Files
- `supercoach-ai-native/app.json` — rename app, update identifiers
- `supercoach-ai-native/package.json` — add `react-native-purchases` dependency
- `supercoach-ai-native/app/settings.tsx` — replace billing section with RevenueCat paywall
- `supercoach-ai-native/services/config.ts` — add RevenueCat API key config
- `supercoach-ai-native/app/_layout.tsx` — init RevenueCat on mount
- `supercoach-ai-native/hooks/useAuth.ts` — sync entitlements from RevenueCat instead of Polar

---

## Task 1: Rebrand — SuperCoach AI → Secret Coach AI

**Files:**
- Modify: `supercoach-ai-native/app.json`
- Modify: `supercoach-ai-native/package.json`

- [ ] **Step 1: Update app.json**

Change app name, slug, scheme, bundle ID, and package name:

```json
{
  "expo": {
    "name": "Secret Coach AI",
    "slug": "secret-coach-ai",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "scheme": "secretcoach",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#0A0E1A"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "ai.secretcoach.app"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0A0E1A"
      },
      "package": "ai.secretcoach.app"
    },
    "web": {
      "bundler": "metro",
      "output": "static",
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-router"
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

- [ ] **Step 2: Update package.json name**

Change `"name": "supercoach-ai-native"` to `"name": "secret-coach-ai"`.

- [ ] **Step 3: Commit**

```bash
cd supercoach-ai-native
git add app.json package.json
git commit -m "chore: rebrand SuperCoach AI to Secret Coach AI"
```

---

## Task 2: Create App Assets (Icon, Splash, Adaptive Icon)

**Files:**
- Create: `supercoach-ai-native/assets/icon.png`
- Create: `supercoach-ai-native/assets/adaptive-icon.png`
- Create: `supercoach-ai-native/assets/splash-icon.png`
- Create: `supercoach-ai-native/assets/favicon.png`

- [ ] **Step 1: Create assets directory**

```bash
mkdir -p supercoach-ai-native/assets
```

- [ ] **Step 2: Generate placeholder app icon**

Use a script or image tool to create a 1024x1024 dark blue (#0A0E1A) icon with a white shield/lock motif and "SC" text. For now, generate simple solid-color placeholders so the build doesn't fail:

```bash
cd supercoach-ai-native
npx expo-image-generator --size 1024 --bg "#0A0E1A" --text "SC" --output assets/icon.png
```

If the generator isn't available, create placeholder PNGs programmatically with sharp or any available tool. The key requirement: 1024x1024 for `icon.png` and `adaptive-icon.png`, a smaller logo for `splash-icon.png`, and 196x196 for `favicon.png`.

- [ ] **Step 3: Verify all 4 asset files exist**

```bash
ls -la supercoach-ai-native/assets/
```

Expected: `icon.png`, `adaptive-icon.png`, `splash-icon.png`, `favicon.png`

- [ ] **Step 4: Commit**

```bash
git add supercoach-ai-native/assets/
git commit -m "chore: add placeholder app icon and splash assets"
```

---

## Task 3: Create EAS Build Configuration

**Files:**
- Create: `supercoach-ai-native/eas.json`

- [ ] **Step 1: Create eas.json**

```json
{
  "cli": {
    "version": ">= 15.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_API_URL": "https://secretcoach.ai"
      }
    },
    "preview": {
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_API_URL": "https://secretcoach.ai"
      }
    },
    "production": {
      "autoIncrement": true,
      "env": {
        "EXPO_PUBLIC_API_URL": "https://secretcoach.ai"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "REPLACE_WITH_APPLE_ID",
        "ascAppId": "REPLACE_WITH_ASC_APP_ID",
        "appleTeamId": "REPLACE_WITH_TEAM_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./google-services.json",
        "track": "internal"
      }
    }
  }
}
```

- [ ] **Step 2: Install EAS CLI globally (if not already)**

```bash
npm install -g eas-cli
```

- [ ] **Step 3: Verify EAS config**

```bash
cd supercoach-ai-native && eas config
```

- [ ] **Step 4: Commit**

```bash
git add eas.json
git commit -m "chore: add EAS Build configuration"
```

---

## Task 4: Add Visualize Tab Placeholder

The tab layout references `visualize` but no screen file exists. Create a "Coming Soon" placeholder to prevent crashes.

**Files:**
- Create: `supercoach-ai-native/app/(tabs)/visualize.tsx`

- [ ] **Step 1: Create visualize.tsx**

```tsx
import React from 'react';
import { View, Text } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { useTranslation } from '../../shared/i18n/useTranslation';

export default function VisualizeScreen() {
  const { t } = useTranslation();

  return (
    <View className="flex-1 bg-[#0A0E1A] items-center justify-center px-8">
      <Sparkles color="#71B7FF" size={48} />
      <Text className="text-white text-xl font-bold mt-4">
        {t.visualization.title}
      </Text>
      <Text className="text-neutral-400 text-sm text-center mt-2">
        Coming Soon
      </Text>
    </View>
  );
}
```

- [ ] **Step 2: Verify tab navigation works**

```bash
cd supercoach-ai-native && npx tsc --noEmit
```

Expected: No type errors related to the visualize screen.

- [ ] **Step 3: Commit**

```bash
git add app/\(tabs\)/visualize.tsx
git commit -m "feat: add Visualize tab placeholder (Coming Soon)"
```

---

## Task 5: Install and Configure RevenueCat SDK

**Files:**
- Modify: `supercoach-ai-native/package.json`
- Modify: `supercoach-ai-native/services/config.ts`
- Modify: `supercoach-ai-native/app/_layout.tsx`

- [ ] **Step 1: Install react-native-purchases**

```bash
cd supercoach-ai-native && npm install react-native-purchases
```

- [ ] **Step 2: Update config.ts with RevenueCat keys**

Replace the entire file:

```typescript
export const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? '';

export const REVENUECAT_API_KEY_IOS = process.env.EXPO_PUBLIC_RC_IOS_KEY ?? '';
export const REVENUECAT_API_KEY_ANDROID = process.env.EXPO_PUBLIC_RC_ANDROID_KEY ?? '';
```

- [ ] **Step 3: Initialize RevenueCat in root layout**

Modify `app/_layout.tsx` — add RevenueCat init inside `RootLayout`:

Import at top:
```typescript
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import { REVENUECAT_API_KEY_IOS, REVENUECAT_API_KEY_ANDROID } from '../services/config';
```

Add useEffect after state declarations:
```typescript
React.useEffect(() => {
  const apiKey = Platform.OS === 'ios'
    ? REVENUECAT_API_KEY_IOS
    : REVENUECAT_API_KEY_ANDROID;
  if (apiKey) {
    Purchases.configure({ apiKey });
  }
}, []);
```

- [ ] **Step 4: Run typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json services/config.ts app/_layout.tsx
git commit -m "feat: install and configure RevenueCat SDK"
```

---

## Task 6: Create Purchase Service

**Files:**
- Create: `supercoach-ai-native/services/purchaseService.ts`

- [ ] **Step 1: Create purchaseService.ts**

```typescript
import Purchases, {
  type PurchasesOfferings,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';

export type PlanTier = 'explorer' | 'essential' | 'visionary' | 'master';

/** Entitlement IDs configured in RevenueCat dashboard */
const ENTITLEMENT_MAP: Record<string, PlanTier> = {
  essential: 'essential',
  visionary: 'visionary',
  master: 'master',
};

/** Identify user with RevenueCat (call after Firebase auth) */
export async function identifyUser(uid: string): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.logIn(uid);
  return customerInfo;
}

/** Log out from RevenueCat (call on Firebase sign-out) */
export async function logOutPurchases(): Promise<void> {
  await Purchases.logOut();
}

/** Get available subscription offerings */
export async function getOfferings(): Promise<PurchasesOfferings> {
  return Purchases.getOfferings();
}

/** Purchase a package */
export async function purchasePackage(
  pkg: PurchasesPackage,
): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

/** Restore previous purchases */
export async function restorePurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}

/** Get current customer info */
export async function getCustomerInfo(): Promise<CustomerInfo> {
  return Purchases.getCustomerInfo();
}

/** Derive the plan tier from entitlements */
export function getPlanFromCustomerInfo(info: CustomerInfo): PlanTier {
  for (const [entitlementId, plan] of Object.entries(ENTITLEMENT_MAP)) {
    if (info.entitlements.active[entitlementId]?.isActive) {
      return plan;
    }
  }
  return 'explorer';
}
```

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add services/purchaseService.ts
git commit -m "feat: add RevenueCat purchase service"
```

---

## Task 7: Create usePurchases Hook

**Files:**
- Create: `supercoach-ai-native/hooks/usePurchases.ts`

- [ ] **Step 1: Create usePurchases.ts**

```typescript
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
    return () => Purchases.removeCustomerInfoUpdateListener(listener);
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
```

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add hooks/usePurchases.ts
git commit -m "feat: add usePurchases hook for subscription state"
```

---

## Task 8: Integrate RevenueCat into Auth Flow

**Files:**
- Modify: `supercoach-ai-native/hooks/useAuth.ts`

- [ ] **Step 1: Import purchaseService in useAuth.ts**

Add at top of file:
```typescript
import { identifyUser, logOutPurchases, getCustomerInfo, getPlanFromCustomerInfo } from '../services/purchaseService';
```

- [ ] **Step 2: Identify user with RevenueCat after Firebase auth**

Find the section where profile is loaded after authentication. After `loadProfile(userId)` succeeds, add:

```typescript
// Sync RevenueCat identity
try {
  const rcInfo = await identifyUser(userId);
  const rcPlan = getPlanFromCustomerInfo(rcInfo);
  if (rcPlan !== 'explorer') {
    profile.billingPlan = rcPlan;
    profile.billingIsActive = true;
  }
} catch (rcErr) {
  console.warn('[Auth] RevenueCat identify failed:', rcErr);
}
```

- [ ] **Step 3: Log out from RevenueCat on sign-out**

Find the logout/signOut function. Add before or after Firebase sign-out:

```typescript
try { await logOutPurchases(); } catch {}
```

- [ ] **Step 4: Remove any Polar sync-subscription calls**

Search for references to `syncSubscription` from polarService and remove them. The native app should rely solely on RevenueCat for billing state.

- [ ] **Step 5: Run typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add hooks/useAuth.ts
git commit -m "feat: integrate RevenueCat identity with auth flow"
```

---

## Task 9: Update Settings Screen — RevenueCat Paywall

**Files:**
- Modify: `supercoach-ai-native/app/settings.tsx`

- [ ] **Step 1: Import usePurchases hook**

Add at top of settings.tsx:
```typescript
import { usePurchases } from '../hooks/usePurchases';
```

- [ ] **Step 2: Use hook in component**

Inside the Settings component, add:
```typescript
const { plan: rcPlan, offerings, purchase, restore, loading: rcLoading } = usePurchases();
```

- [ ] **Step 3: Replace the billing section (lines ~530-594)**

Replace the existing PLANS map and static plan cards with a dynamic paywall that shows RevenueCat offerings:

```tsx
{/* ====== SUBSCRIPTION SECTION ====== */}
<Section>
  <SectionHeader
    icon={<Crown size={14} color={ICON_COLOR} />}
    label={labels.subscription}
    right={
      <TouchableOpacity onPress={restore}>
        <Text className="text-xs text-indigo-500">Restore</Text>
      </TouchableOpacity>
    }
  />

  <View className="px-4 pb-4 gap-2">
    {offerings?.current?.availablePackages.map((pkg) => {
      const product = pkg.product;
      const isCurrent = rcPlan === pkg.identifier;
      return (
        <TouchableOpacity
          key={pkg.identifier}
          disabled={isCurrent || rcLoading}
          onPress={() => purchase(pkg)}
          className={`rounded-xl border px-3 py-2.5 ${
            isCurrent
              ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
              : 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-850'
          }`}
        >
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {product.title}
              </Text>
              <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                {product.priceString}
              </Text>
            </View>
            {isCurrent && (
              <View className="border border-indigo-400 rounded-full px-2 py-0.5">
                <Text className="text-[10px] text-indigo-500 dark:text-indigo-400 font-bold">
                  {labels.currentPlan}
                </Text>
              </View>
            )}
          </View>
          {product.description ? (
            <Text className="text-[10px] text-neutral-400 mt-1">
              {product.description}
            </Text>
          ) : null}
        </TouchableOpacity>
      );
    })}

    {!offerings?.current && !rcLoading && (
      <Text className="text-xs text-neutral-500 text-center py-4">
        {labels.currentPlan}: {rcPlan}
      </Text>
    )}
  </View>
</Section>
```

- [ ] **Step 4: Remove old PLANS constant and PLAN_ORDER references**

Remove the static `PLANS` array (lines ~49-63) and any `PLAN_ORDER` constant since RevenueCat provides this data dynamically. Keep the `PlanTier` type if still used elsewhere.

- [ ] **Step 5: Run typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add app/settings.tsx
git commit -m "feat: replace static billing section with RevenueCat paywall"
```

---

## Task 10: Create RevenueCat Webhook API Endpoint

**Files:**
- Create: `api/revenuecat-webhook.ts` (in the web app root, alongside existing API routes)

- [ ] **Step 1: Create the webhook handler**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

const PRODUCT_TO_PLAN: Record<string, string> = {
  [process.env.RC_PRODUCT_ID_ESSENTIAL ?? '']: 'essential',
  [process.env.RC_PRODUCT_ID_VISIONARY ?? '']: 'visionary',
  [process.env.RC_PRODUCT_ID_MASTER ?? '']: 'master',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // Verify webhook authorization
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.REVENUECAT_WEBHOOK_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const event = req.body;
    const appUserId = event?.event?.app_user_id;

    if (!appUserId) {
      return res.status(400).json({ error: 'Missing app_user_id' });
    }

    const eventType = event?.event?.type;
    const productId = event?.event?.product_id ?? '';
    const plan = PRODUCT_TO_PLAN[productId] ?? 'explorer';

    const activeEvents = [
      'INITIAL_PURCHASE',
      'RENEWAL',
      'UNCANCELLATION',
      'NON_RENEWING_PURCHASE',
      'PRODUCT_CHANGE',
    ];
    const inactiveEvents = [
      'CANCELLATION',
      'EXPIRATION',
      'BILLING_ISSUE',
    ];

    let isActive = false;
    if (activeEvents.includes(eventType)) {
      isActive = true;
    } else if (inactiveEvents.includes(eventType)) {
      isActive = false;
    } else {
      // For other events, keep existing state
      return res.status(200).json({ ok: true, skipped: eventType });
    }

    const profileRef = db.doc(`users/${appUserId}/profile/main`);
    await profileRef.set(
      {
        billingProvider: 'revenuecat',
        billingPlan: isActive ? plan : 'explorer',
        billingIsActive: isActive,
        billingUpdatedAt: Date.now(),
      },
      { merge: true },
    );

    return res.status(200).json({ ok: true, plan: isActive ? plan : 'explorer' });
  } catch (err: any) {
    console.error('[RC Webhook] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

- [ ] **Step 2: Add environment variables to Vercel**

Required env vars (to be set in Vercel dashboard):
- `REVENUECAT_WEBHOOK_SECRET` — shared secret for webhook auth
- `RC_PRODUCT_ID_ESSENTIAL` — RevenueCat product ID for Essential
- `RC_PRODUCT_ID_VISIONARY` — RevenueCat product ID for Visionary
- `RC_PRODUCT_ID_MASTER` — RevenueCat product ID for Master

- [ ] **Step 3: Commit**

```bash
git add api/revenuecat-webhook.ts
git commit -m "feat: add RevenueCat webhook for Firestore billing sync"
```

---

## Task 11: Typecheck and Fix Build Errors

**Files:**
- Various files as needed

- [ ] **Step 1: Run full typecheck**

```bash
cd supercoach-ai-native && npx tsc --noEmit 2>&1
```

- [ ] **Step 2: Fix any type errors found**

Common expected issues:
- Missing type imports for RevenueCat
- Any references to Polar service that were missed
- The `visualize.tsx` screen may need i18n key fixes

Fix each error and re-run typecheck.

- [ ] **Step 3: Test that Expo starts without crash**

```bash
npx expo start --no-dev --minify 2>&1 | head -20
```

Expected: Bundling succeeds without errors.

- [ ] **Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix: resolve type errors and build issues"
```

---

## Task 12: Test EAS Build (Preview)

**Files:** None (build verification)

- [ ] **Step 1: Login to Expo**

```bash
eas login
```

- [ ] **Step 2: Run preview build for Android**

```bash
cd supercoach-ai-native && eas build --platform android --profile preview
```

Expected: Build queues and completes successfully on EAS.

- [ ] **Step 3: Run preview build for iOS**

```bash
eas build --platform ios --profile preview
```

Note: iOS build requires Apple Developer account credentials. If not yet available, document the error and move on.

- [ ] **Step 4: Commit any build-related fixes**

```bash
git add -A
git commit -m "fix: resolve EAS build issues"
```

---

## Task 13: Developer Account Setup & Store Submission

This task requires manual account creation that cannot be automated:

- [ ] **Step 1: Create Apple Developer Account**
  - Go to developer.apple.com, enroll in Apple Developer Program ($99/year)
  - Note: Approval takes 24-48 hours

- [ ] **Step 2: Create Google Play Developer Account**
  - Go to play.google.com/console, pay $25 one-time registration fee
  - Note: Approval may take a few days

- [ ] **Step 3: Update eas.json submit config**

Replace placeholder values in `eas.json` with actual Apple/Google credentials.

- [ ] **Step 4: Set up RevenueCat dashboard**
  - Create RevenueCat project at app.revenuecat.com
  - Connect Apple App Store and Google Play Store
  - Create 3 products: Essential, Visionary, Master
  - Create entitlements matching product IDs
  - Set up webhook URL: `https://secretcoach.ai/api/revenuecat-webhook`
  - Copy API keys (iOS + Android) to `.env`

- [ ] **Step 5: Create privacy policy page**

Deploy a privacy policy page at `https://secretcoach.ai/privacy` covering:
- Data collected (name, email, goals, todos, usage)
- Firebase/Firestore storage
- AI processing (Gemini)
- Subscription billing (Apple/Google via RevenueCat)

- [ ] **Step 6: Build production and submit**

```bash
cd supercoach-ai-native
eas build --platform all --profile production
eas submit --platform all
```

- [ ] **Step 7: Commit final config**

```bash
git add -A
git commit -m "chore: finalize store submission configuration"
```
