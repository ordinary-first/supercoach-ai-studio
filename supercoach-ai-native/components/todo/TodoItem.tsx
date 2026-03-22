import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  interpolateColor,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import {
  Circle,
  CheckCircle2,
  Calendar,
  Target,
  Sun,
  Repeat,
  GripVertical,
} from 'lucide-react-native';
import type { ToDoItem } from '../../shared/types';
import { getRepeatLabel } from '../../shared/constants';

interface TodoItemProps {
  todo: ToDoItem;
  onToggle: (id: string) => void;
  onPress: (todo: ToDoItem) => void;
  drag?: () => void;
  isActive?: boolean;
}

const PRIORITY_BG: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-orange-500',
  low: 'bg-green-500',
};

function formatDate(timestamp?: number | null): string | null {
  if (!timestamp) return null;
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  });
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const TodoItem: React.FC<TodoItemProps> = ({
  todo,
  onToggle,
  onPress,
  drag,
  isActive = false,
}) => {
  const checkScale = useSharedValue(1);
  const isOverdue = todo.dueDate && todo.dueDate < Date.now() && !todo.completed;

  const handleToggle = () => {
    checkScale.value = withSequence(
      withSpring(1.3, { damping: 4 }),
      withSpring(1),
    );
    onToggle(todo.id);
  };

  const checkAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: withTiming(todo.completed ? 0.5 : 1, { duration: 200 }),
    backgroundColor: interpolateColor(
      isActive ? 1 : 0,
      [0, 1],
      ['rgba(26, 31, 46, 0.8)', 'rgba(26, 31, 46, 1)'],
    ),
    transform: [{ scale: withTiming(isActive ? 1.03 : 1, { duration: 150 }) }],
  }));

  return (
    <AnimatedPressable
      onPress={() => onPress(todo)}
      onLongPress={drag}
      disabled={isActive}
      style={[
        containerStyle,
        isActive && {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 8,
        },
      ]}
      className="flex-row items-center gap-3 px-4 py-3 mx-3 mb-2 rounded-2xl border border-gray-700/50"
    >
      {/* Priority indicator */}
      {todo.priority && (
        <View
          className={`absolute left-0 top-1/4 w-1 h-1/2 rounded-r-full ${
            PRIORITY_BG[todo.priority] ?? 'bg-gray-700'
          }`}
        />
      )}

      {/* Checkbox */}
      <Animated.View style={checkAnimStyle}>
        <Pressable onPress={handleToggle} hitSlop={8}>
          {todo.completed ? (
            <CheckCircle2 size={24} color="#71B7FF" />
          ) : (
            <Circle size={24} color="#6B7280" />
          )}
        </Pressable>
      </Animated.View>

      {/* Content */}
      <View className="flex-1 min-w-0">
        <Text
          numberOfLines={2}
          className={`text-base ${
            todo.completed
              ? 'line-through text-gray-500'
              : 'text-white font-medium'
          }`}
        >
          {todo.text}
        </Text>

        {/* Badges row */}
        <View className="flex-row flex-wrap gap-1.5 mt-1.5">
          {todo.isMyDay && (
            <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-400/10 border border-yellow-400/20">
              <Sun size={10} color="#FACC15" />
              <Text className="text-[10px] text-yellow-400">Today</Text>
            </View>
          )}

          {todo.dueDate != null && (
            <View
              className={`flex-row items-center gap-1 px-2 py-0.5 rounded-full border ${
                isOverdue
                  ? 'bg-red-400/10 border-red-400/20'
                  : 'bg-gray-800 border-gray-700'
              }`}
            >
              <Calendar size={10} color={isOverdue ? '#F87171' : '#9CA3AF'} />
              <Text
                className={`text-[10px] ${
                  isOverdue ? 'text-red-400' : 'text-gray-400'
                }`}
              >
                {formatDate(todo.dueDate)}
              </Text>
            </View>
          )}

          {todo.repeat && (
            <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-blue-400/10 border border-blue-400/20">
              <Repeat size={10} color="#60A5FA" />
              <Text className="text-[10px] text-blue-400">
                {getRepeatLabel(todo.repeat)}
              </Text>
            </View>
          )}

          {(todo.linkedNodeText || todo.linkedGoalId) && (
            <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-orange-400/10 border border-orange-400/20">
              <Target size={10} color="#FB923C" />
              <Text
                numberOfLines={1}
                className="text-[10px] text-orange-400 max-w-[100px]"
              >
                {todo.linkedNodeText ?? 'Goal'}
              </Text>
            </View>
          )}

          {todo.tags != null &&
            todo.tags.length > 0 &&
            todo.tags.slice(0, 2).map((tag, idx) => (
              <View
                key={idx}
                className="px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20"
              >
                <Text className="text-[10px] text-accent">#{tag}</Text>
              </View>
            ))}
          {todo.tags != null && todo.tags.length > 2 && (
            <View className="px-2 py-0.5 rounded-full bg-gray-800">
              <Text className="text-[10px] text-gray-500">
                +{todo.tags.length - 2}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Drag handle */}
      {!todo.completed && (
        <Pressable onLongPress={drag} hitSlop={8} className="p-1">
          <GripVertical size={18} color="#4B5563" />
        </Pressable>
      )}
    </AnimatedPressable>
  );
};

export default React.memo(TodoItem);
