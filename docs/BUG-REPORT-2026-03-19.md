# Bug Report: 4-Persona Simulation (2026-03-19)

## 방법론
4개 페르소나 에이전트가 실제 사용 시나리오를 기반으로 코드를 리뷰.
각 에이전트는 담당 영역의 모든 관련 파일을 읽고, 페르소나의 행동 패턴에서 발생할 수 있는 버그를 식별.

---

## Critical (3건)

### C-001: 결제 취소해도 onboarding 완료 처리 [김-002]
- **파일**: `components/OnboardingScreen.tsx:81-91`
- **문제**: 유료 플랜 선택 시 `completeOnboarding(userId)`를 먼저 호출한 후 결제 페이지로 리다이렉트. 결제 취소 시 `onboardingCompleted: true`가 이미 Firestore에 저장됨
- **영향**: 결제 안 했는데 온보딩 다시 안 나옴, billingPlan은 null
- **수정**: completeOnboarding을 결제 성공 webhook에서 호출

### C-002: monthly 반복 할일 31일 anchor 시 2월/4월/6월 누락 [박-002]
- **파일**: `components/CalendarView.tsx:48-50`
- **문제**: `target.getDate() === start.getDate()` 비교로 31일이 없는 달에서 반복 할일 미표시
- **영향**: 매월 말일 반복 할일이 28일/30일인 달에서 실종
- **수정**: `Math.min(anchorDay, lastDayOfMonth)` 사용

### C-003: useDreamChat sendMessage stale closure [이-001]
- **파일**: `hooks/useDreamChat.ts:54`
- **문제**: 빠른 연속 메시지 시 두 번째 API 호출에 첫 번째 메시지 누락
- **영향**: AI가 대화 맥락을 잃음
- **수정**: useRef로 최신 messages 추적

---

## High (12건)

### H-001: 완료된 반복 할일 캘린더 미표시 [박-003]
- **파일**: `components/CalendarView.tsx:153`
- **문제**: ghost 생성에서 `if (t.completed) return false`로 제외, dueDate 없는 반복 할일은 real todos에도 안 잡힘

### H-002: 반복 할일이 피드백 카드 미반영 [박-006]
- **파일**: `components/FeedbackView.tsx:100-119`
- **문제**: `todo.dueDate || todo.createdAt` 기준 필터링으로 반복 발생일에 매칭 안 됨
- **근본원인**: CalendarView의 `checkRecurrenceMatch`가 FeedbackView에서 미사용

### H-003: 미완료 할일도 "completed" 상태 표시 [박-012]
- **파일**: `components/feedback/WeeklyCardScroll.tsx:46`
- **문제**: `dayTodos.length > 0`이면 무조건 `'completed'` 반환

### H-004: audioUrl + audioData 동시 존재 시 재생 실패 [이-003]
- **파일**: `hooks/useVisualizationAudio.ts:94-110`
- **문제**: `audioUrl && !audioData` 조건으로 URL 브랜치 스킵, PCM 브랜치는 null buffer

### H-005: 생성 파이프라인 AbortController 없음 [이-004]
- **파일**: `hooks/useGenerationPipeline.ts:224-327`
- **문제**: 4단계 API 호출(narrative→image→speech→video) 취소 불가

### H-006: CoachChat handleSend stale closure [이-006]
- **파일**: `components/CoachChat.tsx:574-578`
- **문제**: C-003과 동일 패턴. 빠른 연속 대화 시 히스토리 누락

### H-007: beforeunload에서 async flushAll 미완료 [김-004]
- **파일**: `hooks/useAutoSave.ts:100-104`
- **문제**: `flushAll()`이 async지만 await 없이 페이지 종료
- **수정**: `navigator.sendBeacon` 또는 `visibilitychange` 사용

### H-008: localStorage + Firestore 이중 저장 충돌 [김-008]
- **파일**: `stores/useTodoStore.ts:106-113`, `hooks/useAutoSave.ts`
- **문제**: 다른 기기 수정 후 localStorage 복원이 Firestore 최신 데이터 덮어쓸 가능성

### H-009: userId null일 때 Explorer 선택 무한 온보딩 [김-012]
- **파일**: `components/OnboardingScreen.tsx:72-79`
- **문제**: `if (userId)` 체크 실패 → Firestore 미저장 → 새로고침마다 온보딩 반복

### H-010: compressImage Promise reject 없음 [정-007]
- **파일**: `components/SettingsPage.tsx:34-60`
- **문제**: img.onerror/reader.onerror 없어 Promise 영구 pending → UI 고착

### H-011: formData가 prop 변경 시 stale [정-009]
- **파일**: `components/SettingsPage.tsx:126-128`
- **문제**: useState 초기값으로만 profile 사용, 재오픈 시 갱신 안 됨

### H-012: 온보딩에 목표설정 단계 없음 [김-001]
- **파일**: `components/OnboardingScreen.tsx` 전체
- **문제**: 결제 플랜만 있고 목표/자기소개 입력 단계 없음

---

## Medium (30건)

| ID | 버그 | 파일 | 패턴 |
|----|------|------|------|
| M-001 | DST 시 getDayEnd 오차 | FeedbackView.tsx:98 | Timezone |
| M-002 | getMonthWeekNumber 3곳 중복 | FeedbackView/WeeklySummary/WeekDetail | DRY |
| M-003 | 월간요약 하드코딩 한국어 `${month}월` | MonthlySummaryCard.tsx:26 | i18n |
| M-004 | DayDetailSheet 날짜 하드코딩 한국어 | DayDetailSheet.tsx:19-21 | i18n |
| M-005 | 빈 날짜에 메모 작성 불가 | DayDetailSheet.tsx:42 | UX |
| M-006 | currentMonday 장기 세션 미갱신 | FeedbackView.tsx:171 | Stale |
| M-007 | goalAdjustment 텍스트 매칭 | goalAdjustmentService.ts:112-118 | Fragile |
| M-008 | abortRef 선언만 하고 미사용 | useDreamChat.ts:32 | Dead code |
| M-009 | DreamViewer handleClose 타이머 누수 | DreamViewer.tsx:65-72 | Cleanup |
| M-010 | tabLabels 의존성 누락 | CoachChat.tsx:448-466 | Deps |
| M-011 | useCoachMemory 백그라운드 취소 없음 | useCoachMemory.ts:85-108 | Cleanup |
| M-012 | VideoSection 언마운트 미정리 | VideoSection.tsx:33-41 | Cleanup |
| M-013 | DreamGallery 롱프레스 확인 없이 삭제 | DreamGallery.tsx:36-45 | UX |
| M-014 | pendingDirective vs selectedTopic 경쟁 | CoachChat.tsx:374-537 | Race |
| M-015 | generateVideo 폴링 취소 불가 | aiService.ts:493-504 | Abort |
| M-016 | priority 정렬 미구현 | useTodoStore.ts:84-94 | Feature |
| M-017 | Todo ID timestamp 충돌 | TodoEditModal.tsx:64 | ID |
| M-018 | GoalInputModal onClose 순서 | GoalInputModal.tsx:24-30 | State |
| M-019 | dueDate UTC 자정→KST 하루 밀림 | TodoEditModal.tsx:180-183 | Timezone |
| M-020 | MindMap data_change 과도한 리렌더 | MindMap.tsx:966-993 | Perf |
| M-021 | linkedGoalId/linkedNodeId 이중 필드 | types.ts:101-103 | Schema |
| M-022 | saveGoalData merge 없이 덮어쓰기 | firebaseService.ts:208-222 | Data |
| M-023 | GHOST_TEMPLATES stale closure | MindMap.tsx:913-921 | Stale |
| M-024 | Theme 섹션 i18n 누락 | SettingsPage.tsx:487-500 | i18n |
| M-025 | LandingPage 전체 i18n 우회 | LandingPage.tsx | i18n |
| M-026 | 프로필 입력 길이 제한 없음 | SettingsPage.tsx:351-417 | Validation |
| M-027 | 테마 onRehydrate 직접 mutation | useThemeStore.ts:49-53 | State |
| M-028 | 키보드 단축키 숫자키 충돌 | useKeyboardShortcuts.ts:49-54 | UX |
| M-029 | 라이트모드 body 배경 다크 그라데이션 | theme.css:105-118 | CSS |
| M-030 | XSS 미검증 (React 이스케이프로 현재 안전) | firebaseService.ts:328-347 | Security |

---

## Low (18건)

| ID | 버그 | 파일 |
|----|------|------|
| L-001 | Ghost task ID year 누락 | CalendarView.tsx:163 |
| L-002 | isLastWeekOfMonth 월 경계 애매 | FeedbackView.tsx:72-75 |
| L-003 | filter 콜백 변수 t shadowing | CalendarView.tsx:169 |
| L-004 | isOverdue 판정 DST 에지케이스 | FeedbackView.tsx:77-86 |
| L-005 | handleSave null card 무응답 | useGenerationPipeline.ts:329-396 |
| L-006 | prepareAudio audio 객체 의존성 | VisualizationTab.tsx:79 |
| L-007 | CoachChat Enter 동시 전송 | CoachChat.tsx:556-626 |
| L-008 | onKeyPress deprecated + IME | TodoEditModal.tsx:238 |
| L-009 | getFilteredTodos dead code | useTodoStore.ts:73-97 |
| L-010 | loadFeedbackCards 서버 필터 누락 | firebaseService.ts:683-706 |
| L-011 | selectedToDo 삭제 시 패널 잔류 | ToDoList.tsx:374,855 |
| L-012 | BottomDock 리스트 모드 인라인 i18n | BottomDock.tsx:97 |
| L-013 | Age 입력 음수/비현실적 값 허용 | SettingsPage.tsx:367-373 |
| L-014 | ErrorBoundary 언어 기본값 ko | ErrorBoundary.tsx:39 |
| L-015 | usageGuard 에러 메시지 한국어 하드코딩 | usageGuard.ts:122-130 |
| L-016 | LandingPage onLoginSuccess 미사용 | LandingPage.tsx:11 |
| L-017 | chatMessages useEffect deps 누락 | App.tsx:298-304 |
| L-018 | LanguageContext 기본값 en | useTranslation.ts:11-14 |
