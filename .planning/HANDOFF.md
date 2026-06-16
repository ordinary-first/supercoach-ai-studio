# 시각화 탭 재설계 — HANDOFF

## 목표 (one sentence)
시각화 탭을 "씨앗 → 1차 장면 → 수정 버튼 → 갈림길 분기 → 생성" 흐름으로 재설계하고,
첫 화면 추천 말풍선 + 수정 버튼을 어드버서리얼 멀티에이전트로 설계한 AI 프롬프트로 구동한다.

## 브랜치 / 커밋
- 브랜치: `web/visualization-redesign` (워크트리: `.claude/worktrees/visualization-redesign`)
- 기반: `0a2aebc`에서 분기
- 커밋: `bc66545` (구현) + 리뷰 수정 커밋

## 완료한 작업
1. 흐름: 칩/입력 → `dream-chat`(단일 장면 생성) → `refine-buttons`(수정 버튼) →
   탭 시 `scene-variant`(변형) → 갈림길 선택 반복 → 생성 시 `scene-to-prompts`로
   이미지/영상/음성 매체별 프롬프트 변환.
2. AI 프롬프트 2종: `dream-chips`(추천 말풍선, quotedToken 클라이언트 substring 검증 +
   STUCK/인구통계/민감 도메인 사전제거 + label/seed 분리 + write 센티넬),
   `refine-buttons`(명시 욕망 불가침 + 장면-종속 + 겉모습 금지).
   `geminiGenerateJson`(JSON 모드) 헬퍼 신설.
3. 코치 말풍선: 시각화 탭에서 입력 바 위(184px)로 비켜서기.

## 변경 파일 (19 + 핸드오프)
- 신규: server/api/{dream-chips,refine-buttons,scene-variant,scene-to-prompts}.ts
- 수정: lib/geminiClient.ts, server/api/dream-chat.ts, api/[...path].ts,
  services/aiService.ts, hooks/{useDreamChat,useGenerationPipeline}.ts,
  components/visualization/{VisualizationTab,DreamChat,SuggestionBubbles,ChatInput}.tsx,
  components/CoachBubble.tsx, App.tsx, i18n/{ko,en,types}.ts

## 검증
- `tsc --noEmit`: 0 errors
- `vite build`: 통과 (기존 청크 크기 경고만)
- 독립 코드리뷰 2건(프론트 로직 / 클라이언트-엔드포인트 계약): 백엔드 클린,
  프론트 MEDIUM 1(연속전송 레이스)+LOW 2(분기 취소 미연결, 죽은 ref) → 모두 수정 완료.

## 다음 단계 (남은 일)
- 런타임 QA: 새 `/api` 엔드포인트가 동작하는 환경 필요. **vite dev는 `/api`를
  프로덕션(secretcoach.ai)으로 프록시**하므로 미배포 상태에선 새 엔드포인트가 404 →
  폴백만 보임. 라이브 QA는 미리보기 배포 또는 `vercel dev` + 키 필요.
- QA 포인트: (a) 코치 말풍선 184px 실측 미세조정, (b) 한국어 quotedToken substring
  검증의 조사 변형 오필터 가능성("출판"→"출판된"), (c) door 칩 seed가 장면 생성
  입력으로 적절한지, (d) 칩/버튼 실제 출력 품질.

## 결정/제약
- 푸시·PR·배포 안 함 (Vercel 미리보기 과금 회피 — 사용자 메모리 규칙).
- 메인 워크트리 직접 수정 금지 → 격리 워크트리에서 작업.
