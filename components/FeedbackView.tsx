import React, { useState, useMemo, useCallback } from 'react';
import { BarChart3, Loader2, RefreshCw, Target, CheckCircle2, TrendingUp } from 'lucide-react';
import type { GoalNode, ToDoItem, UserProfile } from '../types';
import type { TranslationStrings } from '../i18n/types';
import { generateFeedback } from '../services/aiService';
import { useTranslation } from '../i18n/useTranslation';

type FeedbackPeriod = 'daily' | 'weekly' | 'monthly';

interface FeedbackViewProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: GoalNode[];
  todos: ToDoItem[];
  userProfile: UserProfile | null;
  userId: string | null;
}

const getPeriodRange = (period: FeedbackPeriod): { start: number; end: number } => {
  const now = new Date();
  const end = now.getTime();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  if (period === 'daily') return { start: dayStart, end };
  if (period === 'weekly') return { start: dayStart - 6 * 86400000, end };
  return { start: dayStart - 29 * 86400000, end };
};

const serializeGoalContext = (nodes: GoalNode[], t: TranslationStrings): string => {
  if (nodes.length === 0) return t.feedback.noGoals;
  return nodes
    .map((n) => `- ${n.text} (${t.feedback.progressLabel}: ${n.progress}%, ${t.feedback.statusLabel}: ${n.status})`)
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
  const { t } = useTranslation();

  const periodLabels: Record<FeedbackPeriod, string> = {
    daily: t.feedback.daily,
    weekly: t.feedback.weekly,
    monthly: t.feedback.monthly,
  };

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

    const goalContext = serializeGoalContext(nodes, t);
    const range = getPeriodRange(period);
    const periodTodos = todos.filter((td) => {
      const ref = td.dueDate || td.createdAt;
      return ref >= range.start && ref <= range.end;
    });
    const todoContext = periodTodos.length > 0
      ? periodTodos.map((td) => `- [${td.completed ? 'O' : 'X'}] ${td.text}`).join('\n')
      : t.feedback.noTodosInPeriod;

    const statsContext = [
      `${t.feedback.period}: ${periodLabels[period]}`,
      `${t.feedback.todoCompletion}: ${stats.completedTodos}/${stats.totalTodos} (${stats.completionRate}%)`,
      `${t.feedback.goalAvgProgress}: ${stats.avgProgress}%`,
      `${t.feedback.completedGoalCount}: ${stats.completedNodes}/${stats.totalNodes}`,
    ].join('\n');

    const text = await generateFeedback(period, userProfile, goalContext, todoContext, statsContext, userId);
    setFeedbackText(text || t.feedback.fallbackError);
    setIsLoading(false);
  }, [nodes, todos, period, userProfile, stats, userId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-deep-space flex flex-col overflow-hidden font-body text-white">
      <div className="h-14 md:h-16 border-b border-white/10 bg-black/30 backdrop-blur-md px-4 md:px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-neon-lime" />
          <h1 className="text-sm md:text-base font-semibold tracking-wide">{t.feedback.title}</h1>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-gray-400 hover:text-white transition-colors"
        >
          {t.common.close}
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
                {periodLabels[p]}
              </button>
            ))}
          </div>

          {/* 통계 카드 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
              <CheckCircle2 size={20} className="text-emerald-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{stats.completionRate}%</p>
              <p className="text-[10px] text-gray-400 mt-1">{t.feedback.completionRate}</p>
              <p className="text-[10px] text-gray-500">{stats.completedTodos}/{stats.totalTodos}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
              <TrendingUp size={20} className="text-blue-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{stats.avgProgress}%</p>
              <p className="text-[10px] text-gray-400 mt-1">{t.feedback.avgProgress}</p>
              <p className="text-[10px] text-gray-500">{nodes.filter((n) => n.type !== 'ROOT').length}{t.feedback.goalsCount}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
              <Target size={20} className="text-neon-lime mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{stats.completedNodes}</p>
              <p className="text-[10px] text-gray-400 mt-1">{t.feedback.completedGoals}</p>
              <p className="text-[10px] text-gray-500">{t.feedback.ofTotal.replace('{total}', String(stats.totalNodes))}</p>
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
                {t.feedback.generating}
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                {t.feedback.generate.replace('{period}', periodLabels[period])}
              </>
            )}
          </button>

          {/* 피드백 결과 */}
          {feedbackText && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 size={14} className="text-neon-lime" />
                <span className="text-[11px] uppercase tracking-wider text-gray-400">
                  {periodLabels[period]} {t.feedback.title}
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
