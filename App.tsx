
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import MindMap from './components/MindMap';
import CoachChat from './components/CoachChat';
import CoachBubble from './components/CoachBubble';
import ShortcutsPanel from './components/ShortcutsPanel';
import ToDoList from './components/ToDoList';
import BottomDock, { TabType } from './components/BottomDock';
import VisualizationModal from './components/VisualizationModal';
import CalendarView from './components/CalendarView';
import LandingPage from './components/LandingPage';
import UserProfilePage from './components/UserProfilePage';
import SettingsPage from './components/SettingsPage';
import { GoalNode, GoalLink, NodeType, NodeStatus, ToDoItem, ChatMessage, RepeatFrequency } from './types';
import { generateGoalImage } from './services/aiService';
import { verifyPolarCheckout } from './services/polarService';
import { logout, getUserId, saveProfile } from './services/firebaseService';
import { useAuth } from './hooks/useAuth';
import { useAutoSave, getLinkId } from './hooks/useAutoSave';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useToast } from './hooks/useToast';
import ToastContainer from './components/ToastContainer';
import { Settings as SettingsIcon } from 'lucide-react';

// Helper function to calculate the next occurrence date for recurring todos
const calculateNextDate = (repeat: RepeatFrequency, fromDate: Date): number => {
  const next = new Date(fromDate);
  next.setHours(0, 0, 0, 0);

  switch (repeat) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      return next.getTime();

    case 'weekdays': {
      // Skip to next weekday (skip weekends)
      do {
        next.setDate(next.getDate() + 1);
      } while (next.getDay() === 0 || next.getDay() === 6);
      return next.getTime();
    }

    case 'weekly':
      next.setDate(next.getDate() + 7);
      return next.getTime();

    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      return next.getTime();

    case 'weekly-2': {
      // Next Mon or Thu
      const day = next.getDay();
      if (day < 1) next.setDate(next.getDate() + (1 - day)); // to Monday
      else if (day === 1) next.setDate(next.getDate() + 3); // Mon -> Thu
      else if (day < 4) next.setDate(next.getDate() + (4 - day)); // to Thu
      else next.setDate(next.getDate() + (1 + 7 - day)); // to next Monday
      return next.getTime();
    }

    case 'weekly-3': {
      // Next Mon, Wed, or Fri
      const day = next.getDay();
      if (day < 1) next.setDate(next.getDate() + (1 - day)); // to Monday
      else if (day === 1) next.setDate(next.getDate() + 2); // Mon -> Wed
      else if (day < 3) next.setDate(next.getDate() + (3 - day)); // to Wed
      else if (day === 3) next.setDate(next.getDate() + 2); // Wed -> Fri
      else if (day < 5) next.setDate(next.getDate() + (5 - day)); // to Fri
      else next.setDate(next.getDate() + (1 + 7 - day)); // to next Monday
      return next.getTime();
    }

    case 'weekly-4': {
      // Next Mon, Tue, Thu, or Fri
      const day = next.getDay();
      if (day < 1) next.setDate(next.getDate() + (1 - day)); // to Monday
      else if (day === 1) next.setDate(next.getDate() + 1); // Mon -> Tue
      else if (day === 2) next.setDate(next.getDate() + 2); // Tue -> Thu
      else if (day === 3) next.setDate(next.getDate() + 1); // Wed -> Thu
      else if (day === 4) next.setDate(next.getDate() + 1); // Thu -> Fri
      else next.setDate(next.getDate() + (1 + 7 - day)); // to next Monday
      return next.getTime();
    }

    case 'weekly-5': {
      // Next weekday (Mon-Fri)
      do {
        next.setDate(next.getDate() + 1);
      } while (next.getDay() === 0 || next.getDay() === 6);
      return next.getTime();
    }

    case 'weekly-6': {
      // Next Mon-Sat
      do {
        next.setDate(next.getDate() + 1);
      } while (next.getDay() === 0);
      return next.getTime();
    }

    default:
      return next.getTime();
  }
};

type AppLanguage = 'en' | 'ko';

const LANGUAGE_STORAGE_KEY = 'app_language';

const getInitialLanguage = (): AppLanguage => {
  const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (saved === 'en' || saved === 'ko') return saved;
  return navigator.language.toLowerCase().startsWith('ko') ? 'ko' : 'en';
};

const App: React.FC = () => {
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [activeTab, setActiveTab] = useState<TabType>('GOALS');
  const [language, setLanguage] = useState<AppLanguage>(getInitialLanguage);
  const [isSettingsPageOpen, setIsSettingsPageOpen] = useState(false);

  const [nodes, setNodes] = useState<GoalNode[]>([
    {
        id: 'root',
        text: '나의 인생 비전',
        type: NodeType.ROOT,
        status: NodeStatus.PENDING,
        progress: 0,
        imageUrl: undefined,
        collapsed: false
    }
  ]);
  const [links, setLinks] = useState<GoalLink[]>([]);
  const [todos, setTodos] = useState<ToDoItem[]>([]);
  const [selectedNode, setSelectedNode] = useState<GoalNode | null>(null);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [deleteConfirmNodeId, setDeleteConfirmNodeId] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [imageLoadingNodes, setImageLoadingNodes] = useState<Set<string>>(new Set());

  // Stable callbacks for useAuth to avoid re-triggering data load effect
  const handleGoalDataLoaded = useCallback((loadedNodes: GoalNode[], loadedLinks: GoalLink[]) => {
    setNodes(loadedNodes);
    setLinks(loadedLinks);
  }, []);

  const handleTodosLoaded = useCallback((loadedTodos: ToDoItem[]) => {
    setTodos(loadedTodos);
  }, []);

  // --- Custom Hooks ---
  const { toasts, addToast, removeToast } = useToast();

  const { userProfile, setUserProfile, isInitializing, isDataLoaded, syncStatus, userId } =
    useAuth(handleGoalDataLoaded, handleTodosLoaded);

  useAutoSave(nodes, links, todos, userProfile, isDataLoaded, userId);

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const checkoutId = params.get('checkout_id');
    if (!checkoutId) return;

    (async () => {
      try {
        const result = await verifyPolarCheckout(checkoutId);
        if (cancelled) return;

        if (result.verified && result.isSubscriptionActive) {
          addToast('결제가 확인되었습니다. 구독이 활성화됐습니다.', 'success');
        } else if (result.verified) {
          addToast('결제는 확인되었습니다.', 'success');
        } else {
          addToast('결제 확인 중입니다. 잠시 후 다시 확인해주세요.', 'warning');
        }
      } catch {
        if (!cancelled) {
          addToast('결제 검증에 실패했습니다. 다시 시도해주세요.', 'error');
        }
      } finally {
        if (cancelled) return;
        const clean = new URL(window.location.href);
        clean.searchParams.delete('checkout_id');
        window.history.replaceState({}, '', clean.toString());
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [addToast]);

  // Window resize listener
  useEffect(() => {
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- Goal Node Operations ---
  const handleUpdateNode = useCallback((nodeId: string, updates: Partial<GoalNode>) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, ...updates } : n));
    if (selectedNode && selectedNode.id === nodeId) {
        setSelectedNode(prev => prev ? { ...prev, ...updates } : null);
    }
  }, [selectedNode]);

  const handleUpdateRootNode = useCallback((text: string) => {
      handleUpdateNode('root', { text });
  }, [handleUpdateNode]);

  const handleAddSubNode = useCallback(async (parentId: string, text?: string) => {
    const newNodeId = Date.now().toString();
    const parentNode = nodes.find(n => n.id === parentId);
    let startX = dimensions.width / 2;
    let startY = dimensions.height / 2;
    if (parentNode && parentNode.x && parentNode.y) {
        if (parentNode.collapsed) handleUpdateNode(parentId, { collapsed: false });
        startX = parentNode.x + (Math.random() - 0.5) * 50;
        startY = parentNode.y + (Math.random() - 0.5) * 50;
    }
    const newNode: GoalNode = {
        id: newNodeId, text: text || "", type: NodeType.SUB, status: NodeStatus.PENDING, progress: 0, parentId, x: startX, y: startY, collapsed: false
    };
    setNodes(prev => [...prev, newNode]);
    setLinks(prev => [...prev, { source: parentId, target: newNodeId }]);
    setSelectedNode(newNode);
    if (!text) {
        setEditingNodeId(newNodeId);
    }
  }, [dimensions, nodes, handleUpdateNode]);

  // 紐낆떆???대?吏 ?앹꽦 (濡깊봽?덉뒪 硫붾돱?먯꽌 ?몄텧)
  const handleGenerateNodeImage = useCallback(async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    setImageLoadingNodes(prev => new Set(prev).add(nodeId));
    try {
      const childTexts = nodes
        .filter(n => n.parentId === nodeId && n.text)
        .map(n => n.text);
      const currentUserId = getUserId();
      const imageUrl = await generateGoalImage(
        node.text, userProfile, childTexts, currentUserId, nodeId
      );
      if (imageUrl) handleUpdateNode(nodeId, { imageUrl });
    } catch {
      addToast('이미지 생성에 실패했습니다', 'warning');
    } finally {
      setImageLoadingNodes(prev => {
        const next = new Set(prev); next.delete(nodeId); return next;
      });
    }
  }, [nodes, handleUpdateNode, userProfile, addToast]);

  // ?몃뱶瑜??щ몢濡?蹂??(濡깊봽?덉뒪 硫붾돱?먯꽌 ?몄텧)
  const handleConvertNodeToTodo = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !node.text) return;
    setTodos(prev => [{
      id: Date.now().toString(),
      text: node.text,
      completed: false,
      createdAt: Date.now(),
      linkedNodeId: nodeId,
      linkedNodeText: node.text,
    }, ...prev]);
    addToast('Todo added.', 'success');
  }, [nodes, addToast]);

  const executeDeleteNode = useCallback((nodeId: string) => {
      if (nodeId === 'root') return;
      const nodesToDelete = new Set<string>();
      const stack = [nodeId];
      while(stack.length > 0) {
          const current = stack.pop();
          if(current) {
              nodesToDelete.add(current);
              nodes.filter(n => n.parentId === current).forEach(c => stack.push(c.id));
          }
      }
      setNodes(prev => prev.filter(n => !nodesToDelete.has(n.id)));
      setLinks(prev => prev.filter(l => {
          const sourceId = getLinkId(l.source);
          const targetId = getLinkId(l.target);
          return !nodesToDelete.has(sourceId) && !nodesToDelete.has(targetId);
      }));
      setSelectedNode(null);
      setDeleteConfirmNodeId(null);
  }, [nodes]);

  const handleDeleteNode = useCallback((nodeId: string) => {
      if (nodeId === 'root') return;
      setDeleteConfirmNodeId(nodeId);
  }, []);

  const handleReparentNode = useCallback((childId: string, newParentId: string) => {
      if (childId === newParentId || childId === 'root') return;
      handleUpdateNode(childId, { parentId: newParentId });
      setLinks(prev => [...prev.filter(l => getLinkId(l.target) !== childId), { source: newParentId, target: childId }]);
  }, [handleUpdateNode]);

  // --- Todo Operations ---
  const handleToggleToDo = useCallback((id: string) => {
    setTodos(prev => {
      const todo = prev.find(t => t.id === id);
      if (!todo) return prev;

      // Non-recurring or un-completing: just toggle
      if (!todo.repeat || todo.completed) {
        return prev.map(t => t.id === id ? {...t, completed: !t.completed} : t);
      }

      // Recurring todo being completed (false -> true)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Mark current instance as completed and remove repeat
      const completedInstance: ToDoItem = {
        ...todo,
        completed: true,
        dueDate: todo.dueDate || today.getTime(),
        repeat: null, // Remove repeat so it stays as historical record only
      };

      // Create new active recurring instance
      const nextDueDate = calculateNextDate(todo.repeat, today);
      const newActiveInstance: ToDoItem = {
        ...todo,
        id: Date.now().toString(),
        completed: false,
        createdAt: Date.now(),
        dueDate: nextDueDate,
        isMyDay: false,
      };

      // Replace old with completed, add new active
      return prev.map(t => t.id === id ? completedInstance : t).concat(newActiveInstance);
    });
  }, []);

  const handleTabChange = useCallback((tab: TabType) => {
      setActiveTab(tab);
  }, []);

  // --- Keyboard Shortcuts ---
  useKeyboardShortcuts(
    selectedNode,
    handleAddSubNode,
    handleDeleteNode,
    handleTabChange,
    setSelectedNode,
    setIsShortcutsOpen,
    setIsChatOpen,
    setActiveTab,
  );

  // --- Visible Nodes/Links ---
  const { visibleNodes, visibleLinks } = useMemo(() => {
      const visibleNodeSet = new Set<string>();
      const stack = ['root'];
      while(stack.length > 0) {
          const currentId = stack.pop()!;
          visibleNodeSet.add(currentId);
          const node = nodes.find(n => n.id === currentId);
          if (node && !node.collapsed) nodes.filter(n => n.parentId === currentId).forEach(c => stack.push(c.id));
      }
      return { visibleNodes: nodes.filter(n => visibleNodeSet.has(n.id)), visibleLinks: links.filter(l => visibleNodeSet.has(getLinkId(l.source)) && visibleNodeSet.has(getLinkId(l.target))) };
  }, [nodes, links]);

  // --- Render ---
  if (isInitializing || (userProfile && !isDataLoaded)) {
    return (
      <div className="fixed inset-0 bg-deep-space flex flex-col items-center justify-center gap-6">
        <div className="w-12 h-12 border-4 border-neon-lime border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-gray-500 font-mono tracking-widest animate-pulse">
          {isInitializing ? '초기화 중...' : '데이터 로딩 중...'}
        </p>
      </div>
    );
  }

  if (!userProfile) {
      return <LandingPage onLoginSuccess={(p) => setUserProfile(p)} />;
  }

  return (
    <div className="relative w-screen h-screen bg-deep-space text-white font-body overflow-hidden">
      {activeTab === 'GOALS' && (
        <>
          <MindMap
            nodes={visibleNodes} links={visibleLinks} selectedNodeId={selectedNode?.id} onNodeClick={setSelectedNode} onUpdateNode={handleUpdateNode} onDeleteNode={handleDeleteNode} onReparentNode={handleReparentNode} onAddSubNode={handleAddSubNode} onGenerateImage={handleGenerateNodeImage} onConvertNodeToTask={handleConvertNodeToTodo} editingNodeId={editingNodeId} onEditEnd={() => setEditingNodeId(null)} width={dimensions.width} height={dimensions.height} imageLoadingNodes={imageLoadingNodes}
          />

           <div className="absolute top-[64px] left-3 md:top-[72px] md:left-6 z-50">
               <button
                 onClick={() => setIsShortcutsOpen(prev => !prev)}
                 className="flex items-center gap-2 bg-black/40 backdrop-blur-md border border-white/10 px-3 py-1.5 md:px-4 md:py-2 rounded-full text-[10px] font-bold tracking-widest text-neon-lime hover:bg-neon-lime hover:text-black transition-all"
               >
                   <span className="bg-neon-lime/20 px-1.5 py-0.5 rounded text-[8px] border border-neon-lime/30">K</span>
                   단축키
               </button>
           </div>

         </>
       )}
 
       <div className="absolute top-3 right-3 md:top-6 md:right-6 z-[60]">
         <button
           onClick={() => setIsSettingsPageOpen(true)}
           className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-gray-200 hover:bg-white/15 transition-all flex items-center justify-center"
           aria-label="Open settings"
         >
           <SettingsIcon size={18} />
         </button>
       </div>

      <ToDoList isOpen={activeTab === 'TODO'} onClose={() => setActiveTab('GOALS')} onOpenCalendar={() => setActiveTab('CALENDAR')} todos={todos} onAddToDo={(text) => {
  const trimmed = text.trim().slice(0, 500);
  if (!trimmed) return;
  setTodos(prev => [{id: Date.now().toString(), text: trimmed, completed: false, createdAt: Date.now()}, ...prev]);
}} onToggleToDo={handleToggleToDo} onDeleteToDo={(id) => setTodos(prev => prev.filter(t => t.id !== id))} onUpdateToDo={(id, up) => setTodos(prev => prev.map(t => t.id === id ? {...t, ...up} : t))} />
      <CalendarView isOpen={activeTab === 'CALENDAR'} onClose={() => setActiveTab('GOALS')} todos={todos} onToggleToDo={handleToggleToDo} />
      <CoachChat isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} selectedNode={selectedNode} nodes={nodes} userProfile={userProfile} todos={todos} onUpdateNode={handleUpdateNode} onAddSubNode={handleAddSubNode} onDeleteNode={handleDeleteNode} onUpdateRootNode={handleUpdateRootNode} onManualAddNode={() => handleAddSubNode(selectedNode?.id || 'root')} onOpenVisualization={() => setActiveTab('VISUALIZE')} messages={chatMessages} onMessagesChange={setChatMessages} activeTab={activeTab} />
      <VisualizationModal isOpen={activeTab === 'VISUALIZE'} onClose={() => setActiveTab('GOALS')} userProfile={userProfile} nodes={nodes} />
      <ShortcutsPanel isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
      <BottomDock activeTab={activeTab} onTabChange={handleTabChange} />
      <CoachBubble isOpen={isChatOpen} onToggle={() => setIsChatOpen(prev => !prev)} />

      {/* Sync Status Indicator */}
      {syncStatus !== 'cloud' && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[52] flex items-center gap-2 bg-black/70 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5 animate-fade-in">
          <div className={`w-2 h-2 rounded-full ${syncStatus === 'local-only' ? 'bg-yellow-400' : 'bg-red-400'} animate-pulse`} />
          <span className="text-[10px] font-bold text-gray-300 tracking-wide">
            {syncStatus === 'local-only' ? '로컬에서만 저장 중' : '동기화 불가'}
          </span>
          {syncStatus === 'local-only' && (
            <button
              onClick={() => { logout(); setUserProfile(null); setActiveTab('GOALS'); }}
              className="text-[9px] text-neon-lime font-bold ml-1 hover:underline"
            >
              로그아웃
            </button>
          )}
        </div>
      )}

      <UserProfilePage
        isOpen={activeTab === 'PROFILE'} onClose={() => setActiveTab('GOALS')} profile={userProfile} onSave={(p) => {
          setUserProfile(p);
          const uid = getUserId();
          if (uid) saveProfile(uid, p).catch(() => addToast('프로필 저장에 실패했습니다', 'error'));
        }} onLogout={() => { logout(); setUserProfile(null); setActiveTab('GOALS'); }}
      />

      <SettingsPage
        isOpen={isSettingsPageOpen}
        onClose={() => setIsSettingsPageOpen(false)}
        language={language}
        onLanguageChange={setLanguage}
        userAge={userProfile.age}
        userEmail={userProfile.email}
        userName={userProfile.name}
        externalCustomerId={userProfile.googleId || userId || undefined}
      />

      {deleteConfirmNodeId && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-[#0a0f1a] border border-white/10 rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl">
                  <div className="text-center space-y-4">
                       <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                           <span className="text-3xl">!</span>
                       </div>
                      <h3 className="text-xl font-display font-bold text-white">노드 삭제</h3>
                      <p className="text-sm text-gray-400">
                          "{nodes.find(n => n.id === deleteConfirmNodeId)?.text || '이 노드'}"를 삭제하시겠습니까?
                          {nodes.filter(n => n.parentId === deleteConfirmNodeId).length > 0 && (
                              <span className="block mt-1 text-red-400">하위 노드도 함께 삭제됩니다.</span>
                          )}
                      </p>
                      <div className="flex gap-3 pt-2">
                          <button
                              onClick={() => setDeleteConfirmNodeId(null)}
                              className="flex-1 px-6 py-3 bg-white/5 border border-white/10 rounded-full text-sm font-bold text-gray-300 hover:bg-white/10 transition-all"
                          >
                              취소
                          </button>
                          <button
                              onClick={() => executeDeleteNode(deleteConfirmNodeId)}
                              className="flex-1 px-6 py-3 bg-red-500 rounded-full text-sm font-bold text-white hover:bg-red-400 transition-all shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                          >
                              삭제
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};

export default App;

