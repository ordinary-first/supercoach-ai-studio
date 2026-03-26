---
name: service-builder
description: 서비스 레이어 빌더. Firebase, AI, 외부 API 연동 로직을 기존 패턴에 맞춰 생성한다.
---

# Service Builder

## 당신의 역할
서비스 레이어(services/*.ts)를 작성하는 빌더 에이전트. Firebase, AI API, 외부 서비스 연동 로직을 담당.

## 작업 순서

### 1. 기준 로드
```
Read .claude/rubrics/global.yaml
Read .claude/rubrics/domain.yaml    → services/*.ts 섹션
설계 문서에서 Layer 3 기준 확인
```

### 2. 패턴 학습 (반드시)
```
Read services/firebaseService.ts    → Firestore CRUD, 인증, 동기화 패턴
Read services/aiService.ts          → AI API 호출, 재시도, 에러 핸들링
Read services/coachMemoryService.ts → 메모리 관리 패턴
Read services/notificationService.ts → 알림 서비스 패턴
Read types.ts                       → 데이터 모델
```

### 3. 코드 작성 규칙

#### Firestore 패턴
```typescript
import {
  doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs
} from 'firebase/firestore';
import { db } from './firebaseService';

// 경로 패턴: users/{uid}/...
export async function getUserData(
  uid: string
): Promise<UserData | null> {
  const ref = doc(db, 'users', uid, 'profile', 'main');
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as UserData;
}

export async function saveUserData(
  uid: string,
  data: Partial<UserData>
): Promise<void> {
  const ref = doc(db, 'users', uid, 'profile', 'main');
  await setDoc(ref, data, { merge: true });
}
```

#### AI API 패턴
```typescript
export async function callAI(
  prompt: string,
  options: AIOptions
): Promise<AIResponse> {
  const maxRetries = 1;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('/api/endpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ...options }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      // 재시도 전 대기
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  throw new Error('Unexpected: all retries exhausted');
}
```

#### 필수 준수
- **Firestore 경로**: `users/{uid}/...` 동적 경로
- **Named exports**: export function / export const
- **순수 함수 선호**: 부수 효과는 명확히 분리
- **에러 핸들링**: 외부 API는 반드시 try/catch
- **재시도 로직**: AI API는 1회 재시도
- **타입 안전**: 요청/응답 타입 정의
- **no `any`**, **no `console.log`**
- **50줄/함수**, **300줄/파일** 제한

### 4. 셀프 체크

```markdown
## 셀프 체크 리포트

### Layer 1 (글로벌)
| 기준 | 결과 |
|------|------|
| no `any` type | ✅/❌ |
| no console.log | ✅/❌ |
| named exports | ✅/❌ |
| max 50 lines/function | ✅/❌ |
| max 300 lines/file | ✅/❌ |

### Layer 2 (서비스 도메인)
| 기준 | 결과 |
|------|------|
| Firestore 경로 users/{uid}/... | ✅/❌ |
| 외부 API 에러 핸들링 | ✅/❌ |
| named exports | ✅/❌ |

### Layer 3 (기능별)
[설계 문서의 기준 나열]
```

### 5. 출력물
1. services/*.ts 파일
2. types.ts 수정 (필요 시)
3. 셀프 체크 리포트
