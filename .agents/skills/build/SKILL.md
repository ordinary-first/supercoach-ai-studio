---
name: build
description: 7단계 자동 빌드 파이프라인. 브레인스토밍 → 설계 → 기준 정의 → 구현 → 리뷰 → 검증까지 전자동. 새 기능 구현 시 사용.
---

# /build — Multi-Agent Build Pipeline

이 스킬은 7단계 자동 빌드 파이프라인을 실행합니다.
사용자의 요구사항($ARGUMENTS)을 받아 브레인스토밍 → 설계 → 기준 정의 → 구현 → 리뷰 → 검증까지 전자동으로 진행합니다.

## 선행 조건 (Knowledge-First)

구현 시작 전 반드시:
1. `.Codex/knowledge/til.md` — 관련 문제가 이미 해결된 적 있는지 확인
2. `.Codex/knowledge/patterns.md` — 프로젝트 관례 확인
3. `.Codex/knowledge/decisions.md` — 관련 아키텍처 결정 확인

## Phase 1: 브레인스토밍

사용자 요구사항: $ARGUMENTS

사용자에게 3가지 핵심 질문 (AskUserQuestion 사용):
1. **범위**: "이 기능의 정확한 범위는? (포함할 것 / 제외할 것)"
2. **기존 연결**: "기존 기능(목표/할일/피드백/시각화/코치)과 어떻게 연결되나?"
3. **우선순위**: "가장 중요한 1가지 동작은? (나머지는 후순위로)"

답변을 정리하여 요구사항 문서 작성.

## Phase 2: 설계 + 기준 정의

`docs/plans/{feature-kebab-name}.md` 파일 생성:

```markdown
# {Feature Name} 설계 문서

## 목적
{이 기능이 해결하는 문제}

## 아키텍처
### 생성할 파일
- components/{Name}.tsx — {역할}
- api/{name}.ts — {역할}
- hooks/use{Name}.ts — {역할}
- services/{name}Service.ts — {역할}

### 수정할 파일
- types.ts — {추가할 타입}
- i18n/en.ts, i18n/ko.ts — {추가할 키}
- App.tsx — {연결 방법}

## 데이터 모델
{TypeScript 인터페이스 정의}

## UI 흐름
{사용자 인터랙션 시나리오}

## 기존 코드 재사용
{재사용할 기존 컴포넌트, 훅, 서비스 + 파일 경로}

---

## 수락 기준 (Acceptance Criteria)

### Functional
- "{측정 가능한 동작 설명}"

### UI
- "{측정 가능한 UI 요구사항}"

### Edge Cases
- "{측정 가능한 엣지 케이스 처리}"
```

**기준 작성 규칙:**
- 모든 기준은 측정 가능한 Pass/Fail 문장
- Functional 최소 3개, Edge Cases 최소 2개

## Phase 3: 기준 리뷰 (게이트 #0)

feature-acceptance 리뷰어로 기준 자체를 검증.
보강 필요 시 1회 수정. 통과 시 기준 확정.

## Phase 4: 구현

빌더 에이전트 디스패치:
- `components/*.tsx` → `.Codex/agents/builders/component-builder.md`
- `api/*.ts` → `.Codex/agents/builders/api-builder.md`
- `hooks/*.ts` → `.Codex/agents/builders/hook-builder.md`
- `services/*.ts` → `.Codex/agents/builders/service-builder.md`

독립 파일은 병렬, 의존 관계는 순차.

## Phase 5: 기준 기반 코드 리뷰 (게이트 #1)

4개 리뷰어 병렬 디스패치:
1. `code-standards` → Layer 1 글로벌 기준
2. `security` → 보안 기준 (API 파일 있을 때)
3. `domain-fit` → Layer 2 도메인 기준
4. `feature-acceptance` → Layer 3 기능별 기준

루프: Fail 시 수정 → 재실행 (최대 2회).

## Phase 6: 통합 검증 (게이트 #2)

`npm run build` — 성공 시 Phase 7, 실패 시 수정 (최대 2회).

## Phase 7: 완성

1. Version bump: `V{MM}.{DD}r{revision}`
2. 빌드 완료 리포트 출력
3. `.Codex/metrics/build-log.jsonl`에 메트릭 기록
4. **knowledge/ 업데이트**: 새로 배운 것이 있으면 til.md/patterns.md에 기록
