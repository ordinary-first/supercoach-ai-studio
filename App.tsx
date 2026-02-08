
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { GoalNode, GoalLink, NodeType, NodeStatus, UserProfile, ToDoItem, ChatMessage, RepeatFrequency } from './types';
import { generateGoalImage } from './services/aiService';
import { onAuthUpdate, logout, getUserId, saveGoalData, loadGoalData, saveTodos, loadTodos, saveProfile, loadProfile, testFirestoreConnection } from './services/firebaseService';

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

const App: React.FC = () => {
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [activeTab, setActiveTab] = useState<TabType>('GOALS');
  const [isInitializing, setIsInitializing] = useState(true);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const [nodes, setNodes] = useState<GoalNode[]>([
    { 
        id: 'root', 
        text: '나의 인생 비전', 
        type: NodeType.ROOT, 
        status: NodeStatus.PENDING, 
        progress: 0,
        imageUrl: 'https://picsum.photos/200/200',
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

  // Refs for beforeunload (always have latest values)
  const nodesRef = useRef(nodes);
  const linksRef = useRef(links);
  const todosRef = useRef(todos);
  const isDataLoadedRef = useRef(isDataLoaded);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { linksRef.current = links; }, [links]);
  useEffect(() => { todosRef.current = todos; }, [todos]);
  useEffect(() => { isDataLoadedRef.current = isDataLoaded; }, [isDataLoaded]);

  // Debounce timers for auto-save
  const goalSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const todoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadingDataRef = useRef(false);
  const userIdRef = useRef<string | null>(null);



  // 1. 인증 상태 감시 — onAuthStateChanged가 최초 1회 호출된 후에만 초기화 완료
  useEffect(() => {
    const unsubscribe = onAuthUpdate((profile) => {
      setUserProfile(profile);
      setIsInitializing(false); // Firebase가 인증 상태 확인 후 초기화 완료
      if (profile) {
        localStorage.setItem('user_profile', JSON.stringify(profile));
        const uid = getUserId();
        if (uid && uid !== userIdRef.current) {
          userIdRef.current = uid;
        }
      } else {
        userIdRef.current = null;
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. Load user data from Firestore/localStorage when profile is available
  useEffect(() => {
    if (!userProfile) {
      setIsDataLoaded(false);
      return;
    }

    const userId = userIdRef.current || getUserId();
    if (!userId) {
      setIsDataLoaded(true);
      return;
    }
    userIdRef.current = userId;

    // Skip if already loaded for this user
    if (isDataLoaded) return;

    const loadData = async () => {
      isLoadingDataRef.current = true;
      console.log('[App] Loading data for user:', userId);

      // Test Firestore connection (non-blocking)
      testFirestoreConnection(userId).then(ok => {
        console.log('[App] Firestore connection test:', ok ? '✅ OK' : '❌ FAILED — using localStorage only');
      });

      try {
        const [goalData, todoData, savedProfile] = await Promise.all([
          loadGoalData(userId),
          loadTodos(userId),
          loadProfile(userId),
        ]);

        if (goalData && goalData.nodes.length > 0) {
          setNodes(goalData.nodes);
          setLinks(goalData.links);
        }

        if (todoData && todoData.length > 0) {
          setTodos(todoData);
        }

        // Merge saved profile WITHOUT triggering re-render loop
        if (savedProfile) {
          setUserProfile(prev => {
            if (!prev) return savedProfile;
            return { ...prev, bio: savedProfile.bio, gallery: savedProfile.gallery, age: savedProfile.age, location: savedProfile.location, gender: savedProfile.gender };
          });
        }
      } catch (e) {
        console.error('Data loading error:', e);
      } finally {
        isLoadingDataRef.current = false;
        setIsDataLoaded(true);
      }
    };

    loadData();
  }, [userProfile, isDataLoaded]);

  // 3. Auto-save goals (nodes + links) with debounce
  useEffect(() => {
    if (!userProfile || !isDataLoaded || isLoadingDataRef.current) return;

    const userId = userIdRef.current;
    if (!userId) return;

    if (goalSaveTimerRef.current) clearTimeout(goalSaveTimerRef.current);
    goalSaveTimerRef.current = setTimeout(() => {
      saveGoalData(userId, nodes, links).catch(e => console.error('Goal save error:', e));
    }, 1500);

    return () => {
      if (goalSaveTimerRef.current) clearTimeout(goalSaveTimerRef.current);
    };
  }, [nodes, links, userProfile, isDataLoaded]);

  // 4. Auto-save todos with debounce
  useEffect(() => {
    if (!userProfile || !isDataLoaded || isLoadingDataRef.current) return;

    const userId = userIdRef.current;
    if (!userId) return;

    if (todoSaveTimerRef.current) clearTimeout(todoSaveTimerRef.current);
    todoSaveTimerRef.current = setTimeout(() => {
      saveTodos(userId, todos).catch(e => console.error('Todo save error:', e));
    }, 1500);

    return () => {
      if (todoSaveTimerRef.current) clearTimeout(todoSaveTimerRef.current);
    };
  }, [todos, userProfile, isDataLoaded]);

  // 5. Flush pending saves before page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      const userId = userIdRef.current;
      if (!userId || !isDataLoadedRef.current) return;

      // Cancel pending debounced saves
      if (goalSaveTimerRef.current) clearTimeout(goalSaveTimerRef.current);
      if (todoSaveTimerRef.current) clearTimeout(todoSaveTimerRef.current);

      // Synchronously save to localStorage (Firestore is async and won't complete before unload)
      try {
        const currentNodes = nodesRef.current;
        const currentLinks = linksRef.current;
        const currentTodos = todosRef.current;
        const now = Date.now();

        const serializedGoals = {
          nodes: currentNodes.map(n => ({ id: n.id, text: n.text, type: n.type, status: n.status, progress: n.progress, parentId: n.parentId || null, imageUrl: n.imageUrl || null, collapsed: n.collapsed || false })),
          links: currentLinks.map(l => ({ source: typeof l.source === 'object' ? (l.source as any).id : l.source, target: typeof l.target === 'object' ? (l.target as any).id : l.target })),
          updatedAt: now,
        };
        localStorage.setItem(`supercoach_goals_${userId}`, JSON.stringify(serializedGoals));
        localStorage.setItem(`supercoach_todos_${userId}`, JSON.stringify({ items: currentTodos, updatedAt: now }));
      } catch (e) {
        console.warn('beforeunload save failed:', e);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []); // Empty deps - registered once, uses refs for latest values

  useEffect(() => {
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleUpdateNode = useCallback((nodeId: string, updates: Partial<GoalNode>) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, ...updates } : n));
    if (selectedNode && selectedNode.id === nodeId) {
        setSelectedNode(prev => prev ? { ...prev, ...updates } : null);
    }
  }, [selectedNode]);

  const handleUpdateRootNode = useCallback(async (text: string) => {
      handleUpdateNode('root', { text });
      setImageLoadingNodes(prev => new Set(prev).add('root'));
      const imageUrl = await generateGoalImage(text, userProfile);
      setImageLoadingNodes(prev => { const next = new Set(prev); next.delete('root'); return next; });
      if (imageUrl) handleUpdateNode('root', { imageUrl });
  }, [handleUpdateNode, userProfile]);

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
    if (text) {
        setImageLoadingNodes(prev => new Set(prev).add(newNodeId));
        const imageUrl = await generateGoalImage(text, userProfile);
        setImageLoadingNodes(prev => { const next = new Set(prev); next.delete(newNodeId); return next; });
        if (imageUrl) handleUpdateNode(newNodeId, { imageUrl });
    } else {
        setEditingNodeId(newNodeId);
    }
  }, [dimensions, nodes, handleUpdateNode, userProfile]);

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
          const sourceId = typeof l.source === 'object' ? (l.source as GoalNode).id : l.source;
          const targetId = typeof l.target === 'object' ? (l.target as GoalNode).id : l.target;
          return !nodesToDelete.has(sourceId as string) && !nodesToDelete.has(targetId as string);
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
      setLinks(prev => [...prev.filter(l => (typeof l.target === 'object' ? (l.target as GoalNode).id : l.target) !== childId), { source: newParentId, target: childId }]);
  }, [handleUpdateNode]);

  const handleToggleToDo = useCallback((id: string) => {
    setTodos(prev => {
      const todo = prev.find(t => t.id === id);
      if (!todo) return prev;

      // Non-recurring or un-completing: just toggle
      if (!todo.repeat || todo.completed) {
        return prev.map(t => t.id === id ? {...t, completed: !t.completed} : t);
      }

      // Recurring todo being completed (false → true)
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

  // --- GLOBAL KEYBOARD ENGINE ---
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          const target = e.target as HTMLElement;
          if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

          switch (e.key.toLowerCase()) {
              case 'tab':
                  e.preventDefault();
                  if (selectedNode) handleAddSubNode(selectedNode.id);
                  else handleAddSubNode('root');
                  break;
              case 'enter':
                  if (selectedNode && selectedNode.parentId) {
                      handleAddSubNode(selectedNode.parentId);
                  } else if (selectedNode?.id === 'root') {
                      handleAddSubNode('root');
                  }
                  break;
              case 'delete':
              case 'backspace':
                  if (selectedNode && selectedNode.id !== 'root') handleDeleteNode(selectedNode.id);
                  break;
              case 'escape':
                  setSelectedNode(null);
                  setActiveTab('GOALS');
                  setIsShortcutsOpen(false);
                  setIsChatOpen(false);
                  break;
              case 'k': setIsShortcutsOpen(prev => !prev); break;
              case ' ':
                  e.preventDefault();
                  // Dispatch custom event for MindMap to center on selected node
                  window.dispatchEvent(new CustomEvent('mindmap-center', { detail: { nodeId: selectedNode?.id } }));
                  break;
              case '1': handleTabChange('GOALS'); break;
              case '2': handleTabChange('CALENDAR'); break;
              case '3': handleTabChange('TODO'); break;
              case '4': handleTabChange('VISUALIZE'); break;
              case '5': handleTabChange('PROFILE'); break;
              case '6': setIsChatOpen(prev => !prev); break;
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, handleAddSubNode, handleDeleteNode, handleTabChange, isChatOpen]);

  const { visibleNodes, visibleLinks } = useMemo(() => {
      const visibleNodeSet = new Set<string>();
      const stack = ['root']; 
      while(stack.length > 0) {
          const currentId = stack.pop()!;
          visibleNodeSet.add(currentId);
          const node = nodes.find(n => n.id === currentId);
          if (node && !node.collapsed) nodes.filter(n => n.parentId === currentId).forEach(c => stack.push(c.id));
      }
      return { visibleNodes: nodes.filter(n => visibleNodeSet.has(n.id)), visibleLinks: links.filter(l => visibleNodeSet.has(typeof l.source === 'object' ? (l.source as any).id : l.source) && visibleNodeSet.has(typeof l.target === 'object' ? (l.target as any).id : l.target)) };
  }, [nodes, links]);

  if (isInitializing || (userProfile && !isDataLoaded)) {
    return (
      <div className="fixed inset-0 bg-deep-space flex flex-col items-center justify-center gap-6">
        <div className="w-12 h-12 border-4 border-neon-lime border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-gray-500 font-mono tracking-widest animate-pulse">
          {isInitializing ? '인증 중...' : '데이터 로딩 중...'}
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
            nodes={visibleNodes} links={visibleLinks} selectedNodeId={selectedNode?.id} onNodeClick={setSelectedNode} onUpdateNode={handleUpdateNode} onDeleteNode={handleDeleteNode} onReparentNode={handleReparentNode} onAddSubNode={handleAddSubNode} editingNodeId={editingNodeId} onEditEnd={() => setEditingNodeId(null)} width={dimensions.width} height={dimensions.height} imageLoadingNodes={imageLoadingNodes}
          />

          <div className="absolute top-[72px] left-6 z-50">
              <button
                onClick={() => setIsShortcutsOpen(prev => !prev)}
                className="flex items-center gap-2 bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full text-[10px] font-bold tracking-widest text-neon-lime hover:bg-neon-lime hover:text-black transition-all"
              >
                  <span className="bg-neon-lime/20 px-1.5 py-0.5 rounded text-[8px] border border-neon-lime/30">K</span>
                  단축키
              </button>
          </div>

        </>
      )}

      <ToDoList isOpen={activeTab === 'TODO'} onClose={() => setActiveTab('GOALS')} onOpenCalendar={() => setActiveTab('CALENDAR')} todos={todos} onAddToDo={(text) => setTodos(prev => [{id: Date.now().toString(), text, completed: false, createdAt: Date.now()}, ...prev])} onToggleToDo={handleToggleToDo} onDeleteToDo={(id) => setTodos(prev => prev.filter(t => t.id !== id))} onUpdateToDo={(id, up) => setTodos(prev => prev.map(t => t.id === id ? {...t, ...up} : t))} />
      <CalendarView isOpen={activeTab === 'CALENDAR'} onClose={() => setActiveTab('GOALS')} todos={todos} onToggleToDo={handleToggleToDo} />
      <CoachChat isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} selectedNode={selectedNode} nodes={nodes} userProfile={userProfile} todos={todos} onUpdateNode={handleUpdateNode} onAddSubNode={handleAddSubNode} onDeleteNode={handleDeleteNode} onUpdateRootNode={handleUpdateRootNode} onManualAddNode={() => handleAddSubNode(selectedNode?.id || 'root')} onOpenVisualization={() => setActiveTab('VISUALIZE')} messages={chatMessages} onMessagesChange={setChatMessages} activeTab={activeTab} />
      <VisualizationModal isOpen={activeTab === 'VISUALIZE'} onClose={() => setActiveTab('GOALS')} userProfile={userProfile} nodes={nodes} />
      <ShortcutsPanel isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
      <BottomDock activeTab={activeTab} onTabChange={handleTabChange} />
      <CoachBubble isOpen={isChatOpen} onToggle={() => setIsChatOpen(prev => !prev)} />

      <UserProfilePage
        isOpen={activeTab === 'PROFILE'} onClose={() => setActiveTab('GOALS')} profile={userProfile} onSave={(p) => {
          setUserProfile(p);
          const userId = getUserId();
          if (userId) saveProfile(userId, p).catch(e => console.error('Profile save error:', e));
        }} onLogout={() => { logout(); setUserProfile(null); setActiveTab('GOALS'); }}
      />

      {deleteConfirmNodeId && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-[#0a0f1a] border border-white/10 rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl">
                  <div className="text-center space-y-4">
                      <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                          <span className="text-3xl">🗑️</span>
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
    </div>
  );
};

export default App;
