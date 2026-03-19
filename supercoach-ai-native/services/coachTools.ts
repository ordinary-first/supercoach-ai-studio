/**
 * Coach tool definitions for OpenAI function calling.
 * These define what actions the AI coach can take in the app.
 */

export interface CoachToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string; enum?: string[] }>;
      required: string[];
    };
  };
}

export const COACH_TOOLS: CoachToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'addTodo',
      description: '할일을 추가합니다',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '할일 제목' },
          dueDate: { type: 'string', description: '마감일 (ISO 8601 형식, 선택)' },
          priority: {
            type: 'string',
            description: '우선순위',
            enum: ['low', 'medium', 'high'],
          },
          goalId: { type: 'string', description: '연결할 목표 노드 ID (선택)' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'completeTodo',
      description: '할일을 완료 처리합니다',
      parameters: {
        type: 'object',
        properties: {
          todoId: { type: 'string', description: '완료할 할일 ID' },
        },
        required: ['todoId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'queryTodos',
      description: '할일 목록을 조회합니다',
      parameters: {
        type: 'object',
        properties: {
          filter: {
            type: 'string',
            description: '필터',
            enum: ['all', 'pending', 'completed', 'today'],
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'addGoalNode',
      description: '목표 노드를 추가합니다',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: '목표 이름' },
          parentId: { type: 'string', description: '부모 노드 ID (없으면 ROOT 아래에 추가)' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateGoalNode',
      description: '목표 노드를 수정합니다',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: '수정할 노드 ID' },
          text: { type: 'string', description: '새 목표 이름 (선택)' },
          status: {
            type: 'string',
            description: '새 상태 (선택)',
            enum: ['PENDING', 'COMPLETED', 'STUCK'],
          },
        },
        required: ['nodeId'],
      },
    },
  },
];

/**
 * Parsed tool call from AI response.
 */
export interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Result of executing a tool call.
 */
export interface ToolCallResult {
  toolCallId: string;
  result: string;
  success: boolean;
}

/**
 * System prompt addition that instructs the AI how to call tools.
 * Since we use Gemini (not OpenAI native function calling),
 * we use a prompt-based approach where the AI outputs structured JSON.
 */
export const TOOL_CALLING_PROMPT = `
[도구 사용 가능]
사용자가 할일 추가, 목표 추가, 할일 조회 등을 요청하면 아래 형식으로 응답하세요.
도구 호출과 자연어 응답을 함께 보낼 수 있습니다.

도구 호출 형식:
\`\`\`tool_call
{"name": "도구이름", "arguments": {"key": "value"}}
\`\`\`

사용 가능한 도구:
- addTodo: 할일 추가. 인자: title(필수), dueDate(선택), priority(low/medium/high, 선택), goalId(선택)
- completeTodo: 할일 완료. 인자: todoId(필수)
- queryTodos: 할일 조회. 인자: filter(all/pending/completed/today, 선택)
- addGoalNode: 목표 추가. 인자: text(필수), parentId(선택)
- updateGoalNode: 목표 수정. 인자: nodeId(필수), text(선택), status(PENDING/COMPLETED/STUCK, 선택)

예시:
"네, 장보기 할일을 추가할게요!

\`\`\`tool_call
{"name": "addTodo", "arguments": {"title": "장보기", "priority": "medium"}}
\`\`\`

오늘 저녁에 꼭 다녀오세요!"
`;

/**
 * Parse tool calls from AI response text.
 * Looks for \`\`\`tool_call ... \`\`\` blocks.
 */
export function parseToolCalls(responseText: string): { text: string; toolCalls: ToolCall[] } {
  const toolCalls: ToolCall[] = [];
  const toolCallRegex = /```tool_call\s*\n?([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let cleanText = responseText;

  while ((match = toolCallRegex.exec(responseText)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      toolCalls.push({
        id: `tc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        function: {
          name: parsed.name,
          arguments: JSON.stringify(parsed.arguments || {}),
        },
      });
    } catch {
      // Invalid JSON in tool_call block, skip
    }
    cleanText = cleanText.replace(match[0], '').trim();
  }

  return { text: cleanText, toolCalls };
}
