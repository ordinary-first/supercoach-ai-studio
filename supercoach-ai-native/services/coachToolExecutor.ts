/**
 * Executes tool calls from the AI coach by dispatching actions to Zustand stores.
 */

import type { ToolCall, ToolCallResult } from './coachTools';
import type { GoalNode, GoalLink, ToDoItem, TodoPriority } from '../shared/types';
import { NodeType, NodeStatus } from '../shared/types';

type TodoStore = {
  todos: ToDoItem[];
  addTodo: (todo: ToDoItem) => void;
  toggleComplete: (id: string) => void;
};

type GoalState = {
  nodes: GoalNode[];
  links: GoalLink[];
  setNodes: (fn: (prev: GoalNode[]) => GoalNode[]) => void;
  setLinks: (fn: (prev: GoalLink[]) => GoalLink[]) => void;
};

function generateId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseSafe(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function executeAddTodo(
  args: Record<string, unknown>,
  todoStore: TodoStore,
): string {
  const title = String(args.title || '');
  if (!title) return JSON.stringify({ error: '제목이 필요합니다' });

  const newTodo: ToDoItem = {
    id: `todo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    text: title,
    completed: false,
    createdAt: Date.now(),
    priority: (args.priority as TodoPriority) || undefined,
    dueDate: args.dueDate ? new Date(args.dueDate as string).getTime() : undefined,
    linkedNodeId: (args.goalId as string) || undefined,
    isMyDay: true,
  };

  todoStore.addTodo(newTodo);
  return JSON.stringify({ success: true, message: `"${title}" 할일이 추가되었습니다`, todoId: newTodo.id });
}

function executeCompleteTodo(
  args: Record<string, unknown>,
  todoStore: TodoStore,
): string {
  const todoId = String(args.todoId || '');
  if (!todoId) return JSON.stringify({ error: '할일 ID가 필요합니다' });

  const todo = todoStore.todos.find((t) => t.id === todoId);
  if (!todo) return JSON.stringify({ error: '해당 할일을 찾을 수 없습니다' });

  todoStore.toggleComplete(todoId);
  return JSON.stringify({ success: true, message: `"${todo.text}" 할일이 완료되었습니다` });
}

function executeQueryTodos(
  args: Record<string, unknown>,
  todoStore: TodoStore,
): string {
  const filter = String(args.filter || 'all');
  let filtered = todoStore.todos;

  if (filter === 'pending') {
    filtered = filtered.filter((t) => !t.completed);
  } else if (filter === 'completed') {
    filtered = filtered.filter((t) => t.completed);
  } else if (filter === 'today') {
    filtered = filtered.filter((t) => t.isMyDay);
  }

  const summary = filtered.map((t) => ({
    id: t.id,
    text: t.text,
    completed: t.completed,
    priority: t.priority,
    dueDate: t.dueDate ? new Date(t.dueDate).toISOString().split('T')[0] : null,
  }));

  return JSON.stringify({
    count: summary.length,
    todos: summary,
  });
}

function executeAddGoalNode(
  args: Record<string, unknown>,
  goalState: GoalState,
): string {
  const text = String(args.text || '');
  if (!text) return JSON.stringify({ error: '목표 이름이 필요합니다' });

  let parentId = String(args.parentId || '');
  if (!parentId) {
    const root = goalState.nodes.find((n) => n.type === NodeType.ROOT);
    if (!root) return JSON.stringify({ error: 'ROOT 노드를 찾을 수 없습니다' });
    parentId = root.id;
  }

  const newId = generateId();
  const newNode: GoalNode = {
    id: newId,
    text,
    type: NodeType.SUB,
    status: NodeStatus.PENDING,
    progress: 0,
    parentId,
  };
  const newLink: GoalLink = { source: parentId, target: newId };

  goalState.setNodes((prev) => [...prev, newNode]);
  goalState.setLinks((prev) => [...prev, newLink]);

  return JSON.stringify({ success: true, message: `"${text}" 목표가 추가되었습니다`, nodeId: newId });
}

function executeUpdateGoalNode(
  args: Record<string, unknown>,
  goalState: GoalState,
): string {
  const nodeId = String(args.nodeId || '');
  if (!nodeId) return JSON.stringify({ error: '노드 ID가 필요합니다' });

  const node = goalState.nodes.find((n) => n.id === nodeId);
  if (!node) return JSON.stringify({ error: '해당 목표를 찾을 수 없습니다' });

  goalState.setNodes((prev) =>
    prev.map((n) => {
      if (n.id !== nodeId) return n;
      const updated = { ...n };
      if (args.text) updated.text = String(args.text);
      if (args.status) updated.status = args.status as NodeStatus;
      return updated;
    }),
  );

  return JSON.stringify({ success: true, message: `"${node.text}" 목표가 수정되었습니다` });
}

/**
 * Execute a list of tool calls and return results.
 */
export async function executeToolCalls(
  toolCalls: ToolCall[],
  todoStore: TodoStore,
  goalState: GoalState,
): Promise<ToolCallResult[]> {
  const results: ToolCallResult[] = [];

  for (const call of toolCalls) {
    const args = parseSafe(call.function.arguments);
    let result: string;

    switch (call.function.name) {
      case 'addTodo':
        result = executeAddTodo(args, todoStore);
        break;
      case 'completeTodo':
        result = executeCompleteTodo(args, todoStore);
        break;
      case 'queryTodos':
        result = executeQueryTodos(args, todoStore);
        break;
      case 'addGoalNode':
        result = executeAddGoalNode(args, goalState);
        break;
      case 'updateGoalNode':
        result = executeUpdateGoalNode(args, goalState);
        break;
      default:
        result = JSON.stringify({ error: `Unknown tool: ${call.function.name}` });
    }

    results.push({
      toolCallId: call.id,
      result,
      success: !result.includes('"error"'),
    });
  }

  return results;
}
