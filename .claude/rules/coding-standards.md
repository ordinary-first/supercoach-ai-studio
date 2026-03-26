# Coding Standards

## TypeScript
- No `any` types — use proper types from `/types.ts`
- Functional components only, no class components
- Max 100 chars per line

## State Management
- Zustand only, never Redux
- Stores in `stores/`, access via hooks in `hooks/`

## UI
- All text must use i18n (`t()` function) — no hardcoded strings
- CSS variables for theming (defined in `theme.css`)
- Apple-style glass morphism design language

## AI
- Use Vercel AI SDK (`ai` package) for all new AI calls
- `streamText()` for streaming, `generateText()` for one-shot
- Never call OpenAI/Anthropic SDK directly in new code

## Files
- Components: `components/{FeatureName}/`
- API endpoints: `api/{endpoint-name}.ts`
- Hooks: `hooks/use{Name}.ts`
- Services: `services/{name}Service.ts`
