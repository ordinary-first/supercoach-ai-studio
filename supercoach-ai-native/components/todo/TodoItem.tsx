import React, { useCallback } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  withSpring,
  interpolateColor,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  Circle,
  CheckCircle2,
  Calendar,
  Target,
  Sun,
  Repeat,
  GripVertical,
  Trash2,
  Check,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import type { ToDoItem } from '../../shared/types';
import { getRepeatLabel } from '../../shared/constants';

interface TodoItemProps {
  todo: ToDoItem;
  onToggle: (id: string) => void;
  onPress: (todo: ToDoItem) => void;
  onDelete?: (id: string) => void;
  drag?: () => void;
  isActive?: boolean;
}

const PRIORITY_BG: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-orange-500',
  low: 'bg-green-500',
};

const SWIPE_THRESHOLD = 80;
const MAX_SWIPE = 120;

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
  onDelete,
  drag,
  isActive = false,
}) => {
  const checkScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const rowHeight = useSharedValue(1);
  const rowOpacity = useSharedValue(1);
  const isOverdue = todo.dueDate && todo.dueDate < Date.now() && !todo.completed;

  const triggerHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const triggerComplete = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onToggle(todo.id);
  }, [onToggle, todo.id]);

  const triggerDelete = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (onDelete) {
      Alert.alert(
        'Delete',
        `Delete "${todo.text}"?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => { translateX.value = withSpring(0); } },
          { text: 'Delete', style: 'destructive', onPress: () => {
            rowOpacity.value = withTiming(0, { duration: 200 });
            rowHeight.value = withTiming(0, { duration: 200 }, () => {
              runOnJS(onDelete)(todo.id);
            });
          }},
        ],
      );
    } else {
      translateX.value = withSpring(0);
    }
  }, [onDelete, todo.id, todo.text]);

  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    checkScale.value = withSequence(
      withSpring(1.3, { damping: 4 }),
      withSpring(1),
    );
    onToggle(todo.id);
  };

  // Swipe gesture
  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      // Clamp between -MAX_SWIPE and MAX_SWIPE
      const clamped = Math.max(-MAX_SWIPE, Math.min(MAX_SWIPE, e.translationX));
      translateX.value = clamped;

      // Haptic at threshold crossing
      if (Math.abs(clamped) >= SWIPE_THRESHOLD && Math.abs(e.translationX - clamped) < 5) {
        runOnJS(triggerHaptic)();
      }
    })
    .onEnd(() => {
      if (translateX.value >= SWIPE_THRESHOLD) {
        // Swipe right → complete
        translateX.value = withSpring(0);
        runOnJS(triggerComplete)();
      } else if (translateX.value <= -SWIPE_THRESHOLD) {
        // Swipe left → delete
        runOnJS(triggerDelete)();
      } else {
        // Snap back
        translateX.value = withSpring(0, { damping: 15 });
      }
    });

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

  const swipeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const rowAnimStyle = useAnimatedStyle(() => ({
    opacity: rowOpacity.value,
    maxHeight: interpolate(rowHeight.value, [0, 1], [0, 200]),
    marginBottom: interpolate(rowHeight.value, [0, 1], [0, 8]),
    overflow: 'hidden' as const,
  }));

  // Right action background (complete - green)
  const rightActionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1]),
    transform: [{ scale: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0.5, 1]) }],
  }));

  // Left action background (delete - red)
  const leftActionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, -SWIPE_THRESHOLD], [0, 1]),
    transform: [{ scale: interpolate(translateX.value, [0, -SWIPE_THRESHOLD], [0.5, 1]) }],
  }));

  return (
    <Animated.View style={rowAnimStyle}>
      {/* Action backgrounds */}
      <View className="absolute inset-0 flex-row mx-3 rounded-2xl overflow-hidden">
        {/* Complete action (swipe right) */}
        <View className="flex-1 bg-emerald-500/20 justify-center pl-5">
          <Animated.View style={rightActionStyle}>
            <Check size={22} color="#10B981" />
          </Animated.View>
        </View>
        {/* Delete action (swipe left) */}
        <View className="flex-1 bg-red-500/20 justify-center items-end pr-5">
          <Animated.View style={leftActionStyle}>
            <Trash2 size={22} color="#EF4444" />
          </Animated.View>
        </View>
      </View>

      {/* Swipeable content */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={swipeStyle}>
          <AnimatedPressable
            onPress={() => { Haptics.selectionAsync(); onPress(todo); }}
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
            className="flex-row items-center gap-3 px-4 py-3 mx-3 rounded-2xl border border-white/5"
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
                    ? 'line-through text-neutral-500'
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
                        : 'bg-neutral-800 border-neutral-700'
                    }`}
                  >
                    <Calendar size={10} color={isOverdue ? '#F87171' : '#9CA3AF'} />
                    <Text
                      className={`text-[10px] ${
                        isOverdue ? 'text-red-400' : 'text-neutral-400'
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
                      className="px-2 py-0.5 rounded-full bg-[#71B7FF]/10 border border-[#71B7FF]/20"
                    >
                      <Text className="text-[10px] text-[#71B7FF]">#{tag}</Text>
                    </View>
                  ))}
                {todo.tags != null && todo.tags.length > 2 && (
                  <View className="px-2 py-0.5 rounded-full bg-neutral-800">
                    <Text className="text-[10px] text-neutral-500">
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
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
};

export default React.memo(TodoItem);
