# Progress Tracker

> **규칙**: 매 세션 시작 시 이 파일을 읽고, 세션 종료 시 업데이트하여 커밋한다.
> 다음 세션의 에이전트가 컨텍스트 없이도 즉시 작업을 이어갈 수 있어야 한다.

## 현재 상태

**마지막 업데이트**: 2026-03-19
**마지막 작업**: 4-페르소나 시뮬레이션 버그 탐색 완료

### 버그 현황

| 에이전트 | 담당 영역 | 발견 수 | Critical | High | Medium | Low |
|---------|----------|---------|----------|------|--------|-----|
| 김대리 (27세, 신입) | 목표설정 + 할일관리 | 17 | 1 | 4 | 8 | 3 |
| 박과장 (35세, 워킹맘) | 캘린더 + 피드백 | 14 | 1 | 3 | 6 | 4 |
| 이사원 (30세, 이직준비) | 시각화 + 코치챗 | 15 | 1 | 3 | 7 | 3 |
| 정팀장 (42세, 파워유저) | 설정 + 엣지케이스 | 19 | 0 | 2 | 9 | 8 |
| **합계** | | **65** | **3** | **12** | **30** | **18** |

### Critical 버그 (즉시 수정)

1. **김-002**: 결제 취소해도 `onboardingCompleted: true` 이미 저장 → 상태 불일치
   - 파일: `components/OnboardingScreen.tsx:81-91`
2. **박-002**: monthly 반복 할일 31일 anchor → 2월/4월/6월에 아예 안 보임
   - 파일: `components/CalendarView.tsx:48-50`
3. **이-001**: `useDreamChat.sendMessage`가 stale `messages` 클로저 사용
   - 파일: `hooks/useDreamChat.ts:54`

### High 버그 (1주 내 수정)

4. **박-003**: 완료된 반복 할일이 캘린더 과거 날짜에서 사라짐
5. **박-006**: 반복 할일이 피드백 카드에 전혀 반영 안 됨 (근본 원인: `checkRecurrenceMatch` 미공유)
6. **박-012**: 미완료 할일만 있는 날도 "completed" 상태로 표시
7. **이-003**: `audioUrl` + `audioData` 동시 존재 시 오디오 재생 실패
8. **이-004**: 생성 파이프라인에 AbortController 없음 → 탭 닫아도 API 4개 계속 실행
9. **이-006**: `CoachChat.handleSend`도 stale `messages` 클로저 (이-001과 동일 패턴)
10. **김-004**: `beforeunload`에서 async `flushAll()` 완료 못 함 → 데이터 유실
11. **김-008**: localStorage persist + Firestore 이중 저장 충돌
12. **김-012**: `userId` null일 때 Explorer 선택 → 저장 안 됨
13. **정-007**: `compressImage` Promise에 reject 없음 → 영구 pending
14. **정-009**: `formData`가 prop 변경 시 동기화 안 됨 (stale state)

## 반복 패턴 (시스템적 수정 대상)

| 패턴 | 발생 횟수 | 관련 버그 | 수정 전략 |
|------|----------|----------|----------|
| Stale Closure | 4 | 이-001, 이-006, 김-013, 박-014 | useRef 패턴 또는 functional updater 통일 |
| AbortController 부재 | 4 | 이-002, 이-004, 이-014, 정-017 | 공통 `useAbortable` 훅 생성 |
| useEffect cleanup 미비 | 5 | 이-005, 이-008, 이-009, 박-011, 정-017 | cleanup 패턴 린트 규칙 추가 |
| i18n 하드코딩 | 7 | 박-008, 박-009, 정-001~003, 정-011, 정-012 | `t.` 키 일괄 추가 |
| Recurring task 로직 파편화 | 4 | 박-002, 박-003, 박-006, 박-012 | `checkRecurrenceMatch` → 공통 유틸 추출 |
| 입력 검증 부재 | 3 | 정-004, 정-005, 정-006 | 공통 validation 레이어 |
| DST/Timezone 이슈 | 3 | 박-004, 박-005, 김-007 | date-fns 또는 공통 날짜 유틸 |

## 다음 할 일 (우선순위순)

### Sprint 1: Critical + 시스템적 수정
- [x] Critical 김-002 수정 (결제 취소 시 onboardingCompleted 오염)
- [x] Critical 박-002 수정 (월간 반복 할일 day-31 앵커)
- [x] Critical 이-001 수정 (useDreamChat stale — busyRef로 이미 수정됨, commit 2943d17)
- [x] 이-006 수정 (CoachChat handleSend stale — isSendingRef 가드 추가)
- [ ] `checkRecurrenceMatch` → `lib/recurrence.ts`로 추출, FeedbackView에서 재사용
- [ ] AbortController 부재 일괄 수정 (`useAbortable` 훅)

### Sprint 2: High 버그 수정
- [ ] 오디오 재생 로직 (audioUrl/audioData 우선순위)
- [ ] beforeunload 데이터 유실 (sendBeacon 또는 visibilitychange)
- [ ] localStorage + Firestore 이중 저장 충돌 해결
- [ ] compressImage Promise reject 추가

### Sprint 3: Medium + DX 개선
- [ ] i18n 하드코딩 7건 일괄 수정
- [ ] 입력 검증 레이어 추가
- [ ] DST/Timezone 유틸 통합
- [ ] 라이트 모드 CSS 수정

## 완료된 작업

- [x] 2026-03-19: 4-페르소나 시뮬레이션 버그 탐색 (65개 발견)
- [x] 2026-03-19: 버그 종합 리포트 작성

## 세션 노트

### 2026-03-19 세션
- 김대리/박과장/이사원/정팀장 4개 에이전트 병렬 실행
- 각 에이전트가 실제 사용자 시나리오 기반으로 코드 리뷰
- 65개 버그 발견, 7개 반복 패턴 식별
- 상세 리포트: `docs/BUG-REPORT-2026-03-19.md`
