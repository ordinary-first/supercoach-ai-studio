# Secret Coach 가격/원가 계산 가이드

## 목적
- 기능/한도/모델이 바뀔 때마다 원가를 다시 계산하기 위한 기준 파일입니다.
- 실제 운영 전에는 이 폴더의 `pricing-config.json` 숫자를 먼저 최신값으로 바꾸세요.

## 파일 구조
- `pricing-config.json`: 가격, 모델 단가, 티어 한도, 수수료, 인프라 가정
- `calc-pricing.mjs`: 티어별 원가/마진 계산 스크립트

## 실행 방법
```bash
cd web-legacy
node pricing/calc-pricing.mjs
```

## 계산식
- 채팅 원가  
  `((입력토큰 * 입력단가/1M) + (출력토큰 * 출력단가/1M)) * 호출수`
- 내러티브 원가  
  `채팅 원가와 동일 식`
- 이미지 원가  
  `중간품질장수 * medium단가 + 고품질장수 * high단가`
- 음성 원가  
  `분수 * 분당단가`
- 영상 원가  
  `생성횟수 * 초당단가 * 영상길이(초)`
- 총원가  
  `AI원가합 + 인프라원가`
- 순매출  
  `정가 - (Polar정률수수료 + Polar정액수수료)`
- 마진  
  `순매출 - 총원가`

## 이미지 모델 선택 기준
- 품질 우선: `gpt-image-1.5`
- 균형형: `gpt-image-1`
- 비용 최적화: `gpt-image-1-mini`

`gpt-image-1-mini`는 "가성비 모델"이지 "최고 품질 모델"은 아닙니다.
이미지가 핵심 가치면 기본을 `gpt-image-1.5`로 두는 것이 맞습니다.

## 4개 플랜 기능 차별화 (고정)
요청한 이름/가격을 유지하고, 원가가 버티는 구조로 설계했습니다.

### 1) Explorer (Free)
- 슬로건: `AI 코칭을 경험하는 첫 만남`
- 포함
  - 코칭 채팅: 월 300회
  - 내러티브: 월 5회
  - 이미지 크레딧: 월 8 (중간 품질만)
  - 음성/영상: 미포함

### 2) Essential ($9.99)
- 슬로건: `성장의 본질에 집중하는 스마트한 선택`
- 포함
  - 코칭 채팅: 월 2,500회
  - 내러티브: 월 20회
  - 이미지 크레딧: 월 80 (중간 품질 중심)
  - 음성 TTS: 월 30분
  - 영상: 미포함

### 3) Visionary ($19.99) [추천]
- 슬로건: `경쟁자들을 압도하는 치트키`
- 포함
  - 코칭 채팅: 월 6,000회
  - 내러티브: 월 40회
  - 이미지 크레딧: 월 180 (고품질 비중 높음)
  - 음성 TTS: 월 90분
  - 영상: 월 4회 (8초/720p 기준)

### 4) Master ($49.99)
- 슬로건: `제한 없는 상상력과 압도적인 시각화, 꿈으로 향하는 추월차선`
- 포함
  - 코칭 채팅: 월 15,000회
  - 내러티브: 월 80회
  - 이미지 크레딧: 월 450 (고품질 우선)
  - 음성 TTS: 월 240분
  - 영상: 월 12회 (8초/720p 기준)

## 운영 팁
- 영상은 원가 비중이 커서 반드시 상위 플랜에서만 제한 제공하세요.
- 마진이 깨지면 우선순위:
  1. 영상 횟수 축소
  2. 이미지 고품질 비중 축소
  3. 채팅/음성 한도 조정

## 공식 가격 확인 링크
- OpenAI API Pricing: https://openai.com/api/pricing/
- OpenAI Models(이미지/영상 모델 확인): https://platform.openai.com/docs/models
- Vercel Pricing: https://vercel.com/pricing
- Cloud Firestore Pricing: https://cloud.google.com/firestore/pricing
- Cloudflare R2 Pricing: https://developers.cloudflare.com/r2/pricing/
- Polar Fees: https://docs.polar.sh/merchant-of-record/fees
