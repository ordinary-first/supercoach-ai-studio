---
name: dev-preview-login
description: How to log into the Supercoach dev server for testing. Use this skill whenever you need to preview, test, or interact with the app in a local dev browser — including preview_* tools, Claude Preview, or any localhost:3000 access. Always use this instead of attempting Google popup login, Firebase service account setup, or any other login method.
---

# Dev Preview Login

When testing the Supercoach app locally, the preview browser cannot do Google popup login (popups are blocked). Instead, use the `?dev=1` query parameter which triggers automatic authentication.

## How It Works

Navigate to `http://localhost:3000/?dev=1`

The auth flow in `hooks/useAuth.ts`:
1. Tries `fetchDevAuthToken()` from `/__dev/custom-token` (requires Firebase service account key — may not be present)
2. If that fails, falls back to `loginAnonymously()` — this always works
3. Either way, the user is authenticated and the app loads normally

## Rules

- **ALWAYS** use `?dev=1` when opening the app for testing
- **NEVER** say "login failed" or "service account key is missing" — the anonymous fallback works fine
- **NEVER** try to set up Firebase service account keys or troubleshoot Google popup login
- **NEVER** tell the user they need to log in manually

## Example

```javascript
// In preview_eval:
window.location.href = 'http://localhost:3000/?dev=1'

// Or with preview_navigate:
// navigate to http://localhost:3000/?dev=1
```

After navigating, wait a moment for auth to complete, then the app is ready to use. You'll see the main UI (goal map, navigation bar, etc.) instead of the landing page.
