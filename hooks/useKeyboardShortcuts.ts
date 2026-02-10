import React, { useEffect } from 'react';
import { GoalNode } from '../types';
import { TabType } from '../components/BottomDock';

export function useKeyboardShortcuts(
  selectedNode: GoalNode | null,
  handleAddSubNode: (parentId: string) => void,
  handleDeleteNode: (nodeId: string) => void,
  handleTabChange: (tab: TabType) => void,
  setSelectedNode: (node: GoalNode | null) => void,
  setIsShortcutsOpen: React.Dispatch<React.SetStateAction<boolean>>,
  setIsChatOpen: React.Dispatch<React.SetStateAction<boolean>>,
  setActiveTab: React.Dispatch<React.SetStateAction<TabType>>,
): void {
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
  }, [selectedNode, handleAddSubNode, handleDeleteNode, handleTabChange, setSelectedNode, setIsShortcutsOpen, setIsChatOpen, setActiveTab]);
}
