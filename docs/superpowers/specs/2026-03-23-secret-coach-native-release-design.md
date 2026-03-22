# Secret Coach AI — Native App Release v1.0

## Overview

Ship the existing React Native (Expo 52) app to iOS and Android app stores as "Secret Coach AI" with core coaching features and in-app subscriptions.

## Scope

### Included (v1.0)

| Feature | Status | Notes |
|---------|--------|-------|
| Goals / Mind Map | Implemented | Vision board, mind map, goal decomposition |
| Calendar | Implemented | Month/week/list view, todo integration |
| Todo | Implemented | Create/edit/complete, priority, repeat, subtasks |
| Feedback | Implemented | Daily/weekly/monthly AI feedback |
| Coach Chat | Implemented | AI coaching conversation |
| Settings | Implemented | Profile, language, theme, notifications |
| Auth | Implemented | Google OAuth + anonymous login |
| In-App Purchase | **NEW** | RevenueCat SDK, 4 subscription tiers |
| Notifications | Implemented | Morning/evening push via expo-notifications |
| App Icon / Splash | **NEW** | Brand assets for Secret Coach AI |
| EAS Build | **NEW** | Build profiles for iOS + Android |
| Store Metadata | **NEW** | Screenshots, descriptions, privacy policy |

### Excluded (v2.0+)

- Visualize tab (image/video/audio generation)
- Principles management
- Todo custom lists, groups, smart lists (My Day / Important / Planned)

## Branding Changes

- App name: "SuperCoach AI" -> "Secret Coach AI"
- Bundle ID (iOS): `com.supercoach.ai` -> `ai.secretcoach.app`
- Package name (Android): `com.supercoach.ai` -> `ai.secretcoach.app`
- URL scheme: `supercoach` -> `secretcoach`
- Splash background: keep `#0A0E1A`

## Architecture

```
+-------------------------------+
|  Expo 52 (EAS Build)          |
|  iOS + Android                |
+-------------------------------+
|  RevenueCat SDK               | <- In-app subscriptions
|  Firebase Auth / Firestore    | <- Auth & data
|  Expo Notifications           | <- Push notifications
+-------------------------------+
|  Vercel API (existing)        | <- chat, feedback, decompose-goal, etc.
+-------------------------------+
```

## In-App Purchase Design

### SDK

- `react-native-purchases` (RevenueCat) for unified iOS/Android subscription management
- RevenueCat handles receipt validation, entitlement checks, and webhook delivery

### Subscription Tiers

Map existing web plans to store products:

| Plan | Monthly Price | Entitlement |
|------|--------------|-------------|
| Explorer | Free | `explorer` |
| Essential | TBD | `essential` |
| Visionary | TBD | `visionary` |
| Master | TBD | `master` |

### Flow

1. User opens Settings -> Billing
2. App presents RevenueCat paywall (native store sheet)
3. User completes Apple/Google payment
4. RevenueCat validates receipt
5. RevenueCat webhook -> Vercel API -> update Firestore `billingPlan`
6. App reads entitlement from RevenueCat SDK on launch

### Integration Points

- New file: `services/purchaseService.ts` — RevenueCat init, offerings, purchase, restore
- New hook: `hooks/usePurchases.ts` — entitlement state, paywall trigger
- Modified: `app/settings.tsx` — billing section uses RevenueCat paywall
- New API: `/api/revenuecat-webhook.ts` — sync subscription to Firestore
- Modified: `services/firebaseService.ts` — read/write billingPlan from RevenueCat state

## EAS Build Configuration

### eas.json

```json
{
  "cli": { "version": ">= 15.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": true }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": { "appleId": "TBD", "ascAppId": "TBD" },
      "android": { "serviceAccountKeyPath": "TBD" }
    }
  }
}
```

### Build Profiles

- `development` — dev client with hot reload
- `preview` — internal testing (TestFlight / internal track)
- `production` — store submission

## App Assets Required

- `assets/icon.png` — 1024x1024 app icon
- `assets/adaptive-icon.png` — 1024x1024 Android adaptive icon foreground
- `assets/splash-icon.png` — splash screen logo
- `assets/favicon.png` — 196x196 web favicon

## Store Metadata

### App Store (iOS)

- Category: Health & Fitness or Lifestyle
- Age rating: 4+
- Privacy policy URL: `https://secretcoach.ai/privacy`
- Screenshots: 6.7" (iPhone 15 Pro Max), 6.5" (iPhone 14 Plus), 12.9" (iPad Pro)

### Google Play

- Category: Health & Fitness or Lifestyle
- Content rating: Everyone
- Privacy policy URL: `https://secretcoach.ai/privacy`
- Screenshots: phone + 7" tablet + 10" tablet

### App Description (bilingual)

**English:**
Secret Coach AI is your personal AI life coach. Set meaningful goals, break them into actionable steps, track daily progress, and receive personalized AI feedback to stay on course.

**Korean:**
Secret Coach AI는 당신만의 AI 라이프 코치입니다. 의미 있는 목표를 설정하고, 실행 가능한 단계로 분해하고, 매일의 진행 상황을 추적하며, 맞춤형 AI 피드백을 받아 목표를 향해 나아가세요.

## Pre-Release Checklist

1. [ ] Rename app and update all identifiers
2. [ ] Integrate RevenueCat SDK with subscription tiers
3. [ ] Create RevenueCat webhook API endpoint
4. [ ] Generate app icon and splash screen assets
5. [ ] Configure EAS Build (eas.json)
6. [ ] Fix any build errors and type issues
7. [ ] Remove/hide Visualize tab from navigation
8. [ ] Test full auth flow on both platforms
9. [ ] Test in-app purchase flow on both platforms
10. [ ] Create Apple Developer account
11. [ ] Create Google Play Developer account
12. [ ] Set up privacy policy page at secretcoach.ai/privacy
13. [ ] Prepare store screenshots
14. [ ] Submit to App Store and Google Play
