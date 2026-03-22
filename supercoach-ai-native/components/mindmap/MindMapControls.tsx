import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Plus,
  GitBranch,
  Pencil,
  Trash2,
  CheckCircle,
  CheckSquare,
  ImageIcon,
  Compass,
} from 'lucide-react-native';

interface MindMapControlsProps {
  visible: boolean;
  onAddChild: () => void;
  onAddSibling: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleComplete: () => void;
  onCreateTodo: () => void;
  onGenerateImage: () => void;
  onDecompose: () => void;
  onExploreWithAI?: () => void;
  isRoot?: boolean;
}

interface ActionButtonProps {
  icon: React.ReactNode;
  onPress: () => void;
  color?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({ icon, onPress, color }) => (
  <TouchableOpacity
    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
    className="w-9 h-9 rounded-full items-center justify-center mx-0.5"
    style={{ backgroundColor: color ?? 'rgba(255,255,255,0.12)' }}
    activeOpacity={0.7}
  >
    {icon}
  </TouchableOpacity>
);

export const MindMapControls: React.FC<MindMapControlsProps> = ({
  visible,
  onAddChild,
  onAddSibling,
  onEdit,
  onDelete,
  onToggleComplete,
  onCreateTodo,
  onGenerateImage,
  onDecompose,
  onExploreWithAI,
  isRoot,
}) => {
  if (!visible) return null;

  const iconSize = 18;
  const iconColor = '#F8FBFF';

  return (
    <View
      className="absolute bottom-0 left-0 right-0 flex-row items-center justify-center py-2 px-3"
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
      }}
    >
      <ActionButton
        icon={<Plus size={iconSize} color={iconColor} />}
        onPress={onAddChild}
      />
      {!isRoot && (
        <ActionButton
          icon={<GitBranch size={iconSize} color={iconColor} />}
          onPress={onAddSibling}
        />
      )}
      <ActionButton
        icon={<Pencil size={iconSize} color={iconColor} />}
        onPress={onEdit}
      />
      <ActionButton
        icon={<CheckCircle size={iconSize} color="#4DE8E0" />}
        onPress={onToggleComplete}
      />
      <ActionButton
        icon={<CheckSquare size={iconSize} color={iconColor} />}
        onPress={onCreateTodo}
      />
      <ActionButton
        icon={<ImageIcon size={iconSize} color={iconColor} />}
        onPress={onGenerateImage}
      />
      {onExploreWithAI && (
        <ActionButton
          icon={<Compass size={iconSize} color="#5AA9FF" />}
          onPress={onExploreWithAI}
          color="rgba(90, 169, 255, 0.15)"
        />
      )}
      <ActionButton
        icon={
          <GitBranch
            size={iconSize}
            color={iconColor}
            style={{ transform: [{ rotate: '180deg' }] }}
          />
        }
        onPress={onDecompose}
      />
      {!isRoot && (
        <ActionButton
          icon={<Trash2 size={iconSize} color="#FF7B72" />}
          onPress={onDelete}
          color="rgba(255, 123, 114, 0.15)"
        />
      )}
    </View>
  );
};
