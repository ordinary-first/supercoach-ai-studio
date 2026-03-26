# SuperCoach AI Studio

## Project Overview
AI 코칭 플랫폼. 목표 관리(MindMap), AI 코치 채팅, 투두, 캘린더, 피드백, 꿈 시각화를 제공.

## Tech Stack
- **Frontend**: React 19 + Vite 6 + TypeScript 5.8 (SPA)
- **AI**: Vercel AI SDK (`ai`) + OpenAI + Anthropic 멀티 프로바이더
- **State**: Zustand (no Redux)
- **Auth/DB**: Firebase Auth + Firestore
- **Storage**: Cloudflare R2 (S3 compatible)
- **Payment**: Polar SDK
- **Mobile**: Capacitor 8 (Android)
- **Deploy**: Vercel (serverless functions + cron)
- **Linter**: Biome

## Commands
```bash
npm run dev          # Vite dev server (port 3000)
npm run build        # Production build
npm run lint         # Biome lint
npm run format       # Biome format
npm run typecheck    # TypeScript type check
npm run build:cap    # Build + Capacitor sync
```

## Architecture
```
/api/            → Vercel serverless functions (19 endpoints)
/components/     → React components (tabs, landing, feedback, todo, visualization)
/hooks/          → Custom React hooks (12+)
/services/       → Backend service layers (firebase, ai, memory, etc.)
/lib/            → Shared utilities (openaiClient, authMiddleware, firebaseAdmin)
/stores/         → Zustand stores
/i18n/           → Internationalization (ko, en)
```

## Knowledge System
- **작업 전**: `.claude/knowledge/` 참조 필수 (til, patterns, decisions, expert-tips)
- **작업 후**: 새 발견은 즉시 knowledge/에 기록
- 자세한 규칙: `.claude/rules/knowledge-first.md`

## Rules & Standards
- 코딩 규칙: `.claude/rules/coding-standards.md`
- Git 워크플로우: `.claude/rules/git-workflow.md`
- Knowledge-First: `.claude/rules/knowledge-first.md`

## Key Patterns
- **AI calls**: Vercel AI SDK (`ai` package) — `streamText()` / `generateText()`
- **Auth**: Firebase Auth + `useAuth` hook, dev mode via `?dev=1`
- **API auth**: `lib/authMiddleware.ts` validates Firebase tokens
- **File uploads**: `/api/upload-*` → Cloudflare R2
- **Coach memory**: 3-tier in `services/coachMemoryService.ts`
- **Payment**: Polar SDK, org: `secret-coach`

## Environment Variables
See `.env.example`. Key: OPENAI_API_KEY, ANTHROPIC_API_KEY, Firebase, R2, Polar keys.

## Important Files
- `App.tsx` — Main orchestrator, routing, auto-save
- `types.ts` — All TypeScript interfaces
- `theme.css` — Design tokens (Apple-style glass morphism)
- `AGENTS.md` — Agent handoff protocol and changelog
