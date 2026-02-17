import React, { useState, useMemo, useCallback } from 'react';
import { BarChart3, Loader2, RefreshCw, Target, CheckCircle2, TrendingUp } from 'lucide-react';
import type { GoalNode, ToDoItem, UserProfile } from '../types';
import { generateFeedback } from '../services/aiService';

type FeedbackPeriod = 'daily' | 'weekly' | 'monthly';

interface FeedbackViewProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: GoalNode[];
  todos: ToDoItem[];
  userProfile: UserProfile | null;
  userId: string | null;
}

const PERIOD_LABELS: Record<FeedbackPeriod, string> = {
  daily: '일간',
  weekly: '주간',
  monthly: '월간',
};

const getPeriodRange = (period: FeedbackPeriod): { start: number; end: number } => {
  const now = new Date();
  const end = now.getTime();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  if (period === 'daily') return { start: dayStart, end };
  if (period === 'weekly') return { start: dayStart - 6 * 86400000, end };
  return { start: dayStart - 29 * 86400000, end };
};

const serializeGoalContext = (nodes: GoalNode[]): string => {
  if (nodes.length === 0) return '목표 없음';
  return nodes
    .map((n) => `- ${n.text} (진행률: ${n.progress}%, 상태: ${n.status})`)
    .join('\n');
};

const FeedbackView: React.FC<FeedbackViewProps> = ({
  isOpen,
  onClose,
  nodes,
  todos,
  userProfile,
  userId,
}) => {
  const [period, setPeriod] = useState<FeedbackPeriod>('daily');
  const [feedbackText, setFeedbackText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const stats = useMemo(() => {
    const range = getPeriodRange(period);

    const periodTodos = todos.filter((t) => {
      const ref = t.dueDate || t.createdAt;
      return ref >= range.start && ref <= range.end;
    });

    const completedTodos = periodTodos.filter((t) => t.completed);
    const totalTodos = periodTodos.length;
    const completionRate = totalTodos > 0
      ? Math.round((completedTodos.length / totalTodos) * 100)
      : 0;

    const subNodes = nodes.filter((n) => n.type !== 'ROOT');
    const completedNodes = subNodes.filter((n) => n.status === 'COMPLETED');
    const avgProgress = subNodes.length > 0
      ? Math.round(subNodes.reduce((sum, n) => sum + (n.progress || 0), 0) / subNodes.length)
      : 0;

    return {
      completedTodos: completedTodos.length,
      totalTodos,
      completionRate,
      completedNodes: completedNodes.length,
      totalNodes: subNodes.length,
      avgProgress,
    };
  }, [nodes, todos, period]);

  const handleGenerate = useCallback(async () => {
    setIsLoading(true);
    setFeedbackText('');

    const goalContext = serializeGoalContext(nodes);
    const range = getPeriodRange(period);
    const periodTodos = todos.filter((t) => {
      const ref = t.dueDate || t.createdAt;
      return ref >= range.start && ref <= range.end;
    });
    const todoContext = periodTodos.length > 0
      ? periodTodos.map((t) => `- [${t.completed ? 'O' : 'X'}] ${t.text}`).join('\n')
      : '해당 기간 할일 없음';

    const statsContext = [
      `기간: ${PERIOD_LABELS[period]}`,
      `할일 완료: ${stats.completedTodos}/${stats.totalTodos} (${stats.completionRate}%)`,
      `목표 평균 진행률: ${stats.avgProgress}%`,
      `완료된 목표: ${stats.completedNodes}/${stats.totalNodes}`,
    ].join('\n');

    const text = await generateFeedback(period, userProfile, goalContext, todoContext, statsContext, userId);
    setFeedbackText(text || '피드백을 생성하지 못했습니다. 다시 시도해주세요.');
    setIsLoading(false);
  }, [nodes, todos, period, userProfile, stats, userId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-deep-space flex flex-col overflow-hidden font-body text-white">
      <div className="h-14 md:h-16 border-b border-white/10 bg-black/30 backdrop-blur-md px-4 md:px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-neon-lime" />
          <h1 className="text-sm md:text-base font-semibold tracking-wide">AI 피드백</h1>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-gray-400 hover:text-white transition-colors"
        >
          닫기
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 pb-[120px]">
        <div className="max-w-lg mx-auto space-y-5">
          {/* 기간 선택 */}
          <div className="flex gap-2">
            {(['daily', 'weekly', 'monthly'] as FeedbackPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => { setPeriod(p); setFeedbackText(''); }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  period === p
                    ? 'bg-neon-lime text-black shadow-[0_0_15px_rgba(204,255,0,0.2)]'
                    : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {/* 통계 카드 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
              <CheckCircle2 size={20} className="text-emerald-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{stats.completionRate}%</p>
              <p className="text-[10px] text-gray-400 mt-1">할일 완료율</p>
              <p className="text-[10px] text-gray-500">{stats.completedTodos}/{stats.totalTodos}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
              <TrendingUp size={20} className="text-blue-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{stats.avgProgress}%</p>
              <p className="text-[10px] text-gray-400 mt-1">평균 진행률</p>
              <p className="text-[10px] text-gray-500">{nodes.filter((n) => n.type !== 'ROOT').length}개 목표</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
              <Target size={20} className="text-neon-lime mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{stats.completedNodes}</p>
              <p className="text-[10px] text-gray-400 mt-1">완료 목표</p>
              <p className="text-[10px] text-gray-500">/{stats.totalNodes}개 중</p>
            </div>
          </div>

          {/* 피드백 생성 버튼 */}
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="w-full py-3.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 bg-neon-lime text-black hover:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                피드백 생성 중...
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                {PERIOD_LABELS[period]} 피드백 생성
              </>
            )}
          </button>

          {/* 피드백 결과 */}
          {feedbackText && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 size={14} className="text-neon-lime" />
                <span className="text-[11px] uppercase tracking-wider text-gray-400">
                  {PERIOD_LABELS[period]} AI 피드백
                </span>
              </div>
              <div className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                {feedbackText}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedbackView;
