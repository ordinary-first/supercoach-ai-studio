
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
  bio?: string;      // 자기소개
  gallery?: string[]; // 관련 사진들 (base64 배열)
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
