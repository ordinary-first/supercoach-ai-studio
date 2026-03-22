# Native App Improvement Queue

## 실행 규칙
1. 이 파일의 최상위 PENDING 항목을 가져간다
2. 상태를 IN_PROGRESS로 변경하고 커밋
3. 웹앱의 같은 화면 코드를 먼저 읽고 참고한다 (네이티브 >= 웹 품질)
4. 구현 완료 후 DONE으로 변경하고 커밋+푸시
5. 작업 중 새 개선점 발견 시 적절한 우선순위에 삽입
6. 다음 PENDING 항목으로 이동

## 품질 기준 (매 작업 후 자가점검)
- [ ] 웹앱 대비 동등 이상의 비주얼 품질
- [ ] 네이티브 제스처 활용 (스와이프, 롱프레스, 핀치)
- [ ] 햅틱 피드백 (터치 반응)
- [ ] 60fps 애니메이션 (Reanimated worklet)
- [ ] 스켈레톤/로딩 상태
- [ ] 에러 상태 UI
- [ ] 빈 상태 UI
- [ ] 다크모드 완벽 지원
- [ ] TypeScript 에러 0개

## 큐

### P0 — 첫인상/핵심 UX (앱스토어 리젝 방지)
- [x] DONE: 로그인 화면 프리미엄 리디자인 (글래스모피즘, 그라디언트, 애니메이션)
- [x] DONE: 앱 아이콘/스플래시 실제 디자인 생성 (1024x1024 브랜드 아이콘)
- [x] DONE: 온보딩 플로우 개선 (웰컴 → 프로필 → 플랜 선택 단계)

### P1 — 핵심 화면 네이티브 품질
- [x] DONE: Goals/비전보드 애니메이션 강화 (셀 리빌, 이미지 줌, 전환 효과)
- [x] DONE: Todo 스와이프 제스처 (좌: 삭제, 우: 완료) + 햅틱
- [x] DONE: 캘린더 제스처 네비게이션 (좌우 스와이프로 월/주 이동)
- [x] DONE: 피드백 화면 차트/그래프 시각화 추가
- [x] DONE: Coach Chat 타이핑 인디케이터 + 메시지 버블 애니메이션

### P2 — 전체 앱 폴리시
- [x] DONE: 전역 햅틱 피드백 (버튼, 토글, 완료 액션)
- [x] DONE: 스켈레톤 로딩 스크린 (모든 데이터 로딩 구간)
- [x] DONE: 화면 전환 애니메이션 (Shared Element Transition)
- [x] DONE: Pull-to-refresh 전체 화면 적용
- [x] DONE: 에러/빈 상태 UI 전체 점검 및 개선
- [x] DONE: 접근성 라벨 (VoiceOver/TalkBack) 전체 추가

### P3 — 앱스토어 제출 준비
- [x] DONE: 앱 스크린샷 생성 (iPhone 15 Pro Max, iPad Pro)
- [x] DONE: 개인정보 처리방침 페이지 배포 (이미 public/privacy, terms, refund 존재)
- [ ] PENDING: 앱 설명 (한/영) 최종 작성
- [ ] PENDING: EAS production 빌드 테스트
- [ ] PENDING: 성능 프로파일링 (메모리 누수, 렌더링 최적화)
