/**
 * 제품 피처 플래그.
 *
 * videoGeneration — AI 영상 생성 (fal.ai Kling). 생성 단가($0.5+/건)가 높아 현재 비활성화.
 *   - false: UI(영상 토글 + 결과 영상 섹션)와 생성 파이프라인을 모두 숨기고 호출도 차단.
 *   - true : 영상 컴포넌트/`generate-video` API/`generateVideo`는 그대로 보존돼 있으므로
 *            이 한 줄만 true로 바꾸면 즉시 부활한다. (server/api/generate-video.ts 등 무삭제)
 */
export const FEATURES: { videoGeneration: boolean } = {
  videoGeneration: false,
};
