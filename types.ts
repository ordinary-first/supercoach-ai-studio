
export enum NodeType {
  ROOT = 'ROOT',
  SUB = 'SUB',
}

export enum NodeStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  STUCK = 'STUCK',
}

export interface GoalNode {
  id: string;
  text: string;
  type: NodeType;
  status: NodeStatus;
  progress: number;
  parentId?: string;
  imageUrl?: string;
  collapsed?: boolean;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GoalLink {
  source: string | GoalNode;
  target: string | GoalNode;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: number;
}

export interface UserProfile {
  name: string;
  email?: string;
  gender: 'Male' | 'Female' | 'Other';
  age: string;
  location: string;
  avatarUrl?: string; 
  googleId?: string;
  bio?: string;
  gallery?: string[];
  billingPlan?: 'explorer' | 'essential' | 'visionary' | 'master' | null;
  billingIsActive?: boolean;
  createdAt?: number;
  onboardingCompleted?: boolean;
}

export type RepeatFrequency = 
  'daily' | 
  'weekdays' | 
  'weekly' | 
  'monthly' | 
  'weekly-2' | 
  'weekly-3' | 
  'weekly-4' | 
  'weekly-5' | 
  'weekly-6' |
  null;

export type TodoPriority = 'low' | 'medium' | 'high';

export interface ToDoItem {
  id: string;
  text: string;
  completed: boolean;
  linkedNodeId?: string;
  linkedNodeText?: string;
  linkedGoalId?: string; // Alias for linkedNodeId for consistency
  createdAt: number;
  isMyDay?: boolean;
  dueDate?: number | null;
  reminder?: number | null;
  repeat?: RepeatFrequency;
  note?: string;
  priority?: TodoPriority;
  tags?: string[];
}

// Review System

export interface Review {
  id: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  userRole?: string;
  rating: number; // 1-5
  text: string;
  createdAt: number;
  approved: boolean;
}

// Coach Memory System

export type ActionType =
  | 'ADD_NODE' | 'UPDATE_NODE' | 'DELETE_NODE' | 'COMPLETE_NODE'
  | 'ADD_TODO' | 'COMPLETE_TODO' | 'DELETE_TODO' | 'UPDATE_TODO'
  | 'UPDATE_PROGRESS' | 'UPDATE_PROFILE' | 'VIEW_TAB'
  | 'CREATE_VISUALIZATION' | 'OPEN_COACH' | 'COACH_CONVERSATION';

export interface ActionLogEntry {
  id: string;
  action: ActionType;
  detail: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface ShortTermMemory {
  summary: string;
  lastActionTimestamp: number;
  updatedAt: number;
}

export interface MidTermMemory {
  summary: string;
  updatedAt: number;
}

export interface LongTermMemory {
  summary: string;
  updatedAt: number;
}

export interface CoachMemoryContext {
  shortTerm: string | null;
  midTerm: string | null;
  longTerm: string | null;
}

