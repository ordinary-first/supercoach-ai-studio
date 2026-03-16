import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Modal,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import {
  X,
  Save,
  Trash2,
  Calendar,
  Repeat,
  Target,
  Tag,
  AlertCircle,
} from 'lucide-react-native';
import type {
  ToDoItem,
  GoalNode,
  RepeatFrequency,
  TodoPriority,
} from '../../shared/types';
import { REPEAT_LABELS } from '../../shared/constants';

interface TodoEditModalProps {
  visible: boolean;
  onClose: () => void;
  todo: ToDoItem | null;
  goals: GoalNode[];
  onSave: (todo: Partial<ToDoItem>) => void;
  onDelete?: (id: string) => void;
}

const REPEAT_OPTIONS: { value: RepeatFrequency; label: string }[] = [
  { value: null, label: 'No Repeat' },
  ...(['daily', 'weekdays', 'weekly', 'weekly-2', 'weekly-3', 'monthly'] as const).map(
    (v) => ({ value: v as RepeatFrequency, label: REPEAT_LABELS[v] ?? v }),
  ),
];

const PRIORITY_OPTIONS: {
  value: TodoPriority;
  label: string;
  color: string;
  bg: string;
  border: string;
}[] = [
  {
    value: 'low',
    label: 'Low',
    color: 'text-gray-400',
    bg: 'bg-gray-800',
    border: 'border-gray-600',
  },
  {
    value: 'medium',
    label: 'Medium',
    color: 'text-orange-400',
    bg: 'bg-orange-900/30',
    border: 'border-orange-500/50',
  },
  {
    value: 'high',
    label: 'High',
    color: 'text-red-400',
    bg: 'bg-red-900/30',
    border: 'border-red-500/50',
  },
];

const EMPTY_FORM: Partial<ToDoItem> = {
  text: '',
  priority: 'medium',
  dueDate: null,
  linkedGoalId: undefined,
  repeat: null,
  tags: [],
  note: '',
};

const TodoEditModal: React.FC<TodoEditModalProps> = ({
  visible,
  onClose,
  todo,
  goals,
  onSave,
  onDelete,
}) => {
  const [formData, setFormData] = useState<Partial<ToDoItem>>(EMPTY_FORM);
  const [tagInput, setTagInput] = useState('');
  const [showRepeatPicker, setShowRepeatPicker] = useState(false);
  const [showGoalPicker, setShowGoalPicker] = useState(false);

  useEffect(() => {
    if (todo) {
      setFormData({
        ...todo,
        linkedGoalId: todo.linkedGoalId ?? todo.linkedNodeId,
      });
    } else {
      setFormData({ ...EMPTY_FORM });
    }
    setTagInput('');
    setShowRepeatPicker(false);
    setShowGoalPicker(false);
  }, [todo, visible]);

  const handleSave = () => {
    if (!formData.text?.trim()) return;
    const data: Partial<ToDoItem> = {
      ...formData,
      linkedNodeId: formData.linkedGoalId,
      linkedNodeText: goals.find((g) => g.id === formData.linkedGoalId)?.text,
    };
    if (!todo) {
      data.id = Date.now().toString();
      data.createdAt = Date.now();
      data.completed = false;
    }
    onSave(data);
    onClose();
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !formData.tags?.includes(trimmed)) {
      setFormData({ ...formData, tags: [...(formData.tags ?? []), trimmed] });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags?.filter((t) => t !== tag) ?? [],
    });
  };

  const formatDateForDisplay = (ts?: number | null): string => {
    if (!ts) return 'Not set';
    return new Date(ts).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-background"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-700/50">
          <Text className="text-xl font-bold text-white tracking-wider">
            {todo ? 'EDIT TASK' : 'NEW TASK'}
          </Text>
          <Pressable onPress={onClose} className="p-2 rounded-lg">
            <X size={24} color="#9CA3AF" />
          </Pressable>
        </View>

        {/* Body */}
        <ScrollView
          className="flex-1 px-5"
          contentContainerStyle={{ paddingVertical: 20, gap: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <View className="gap-2">
            <View className="flex-row items-center gap-2">
              <AlertCircle size={14} color="#9CA3AF" />
              <Text className="text-xs font-bold text-gray-400 tracking-wider uppercase">
                Task Description
              </Text>
            </View>
            <TextInput
              value={formData.text ?? ''}
              onChangeText={(text) => setFormData({ ...formData, text })}
              placeholder="What needs to be done?"
              placeholderTextColor="#4B5563"
              className="bg-surface border border-gray-700 rounded-xl px-4 py-3 text-white text-base"
              autoFocus={!todo}
            />
          </View>

          {/* Priority */}
          <View className="gap-2">
            <View className="flex-row items-center gap-2">
              <AlertCircle size={14} color="#9CA3AF" />
              <Text className="text-xs font-bold text-gray-400 tracking-wider uppercase">
                Priority
              </Text>
            </View>
            <View className="flex-row gap-2">
              {PRIORITY_OPTIONS.map(({ value, label, color, bg, border }) => {
                const active = formData.priority === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() =>
                      setFormData({ ...formData, priority: value })
                    }
                    className={`flex-1 items-center py-3 rounded-xl border-2 ${
                      active ? `${bg} ${border}` : 'bg-surface border-gray-700'
                    }`}
                  >
                    <Text
                      className={`text-sm font-bold ${
                        active ? color : 'text-gray-500'
                      }`}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Due Date */}
          <View className="gap-2">
            <View className="flex-row items-center gap-2">
              <Calendar size={14} color="#9CA3AF" />
              <Text className="text-xs font-bold text-gray-400 tracking-wider uppercase">
                Due Date
              </Text>
            </View>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() =>
                  setFormData({ ...formData, dueDate: Date.now() })
                }
                className="flex-1 bg-surface border border-gray-700 rounded-xl px-4 py-3"
              >
                <Text className="text-gray-300 text-sm">
                  {formatDateForDisplay(formData.dueDate)}
                </Text>
              </Pressable>
              {formData.dueDate != null && (
                <Pressable
                  onPress={() => setFormData({ ...formData, dueDate: null })}
                  className="items-center justify-center px-3 bg-surface border border-gray-700 rounded-xl"
                >
                  <X size={16} color="#6B7280" />
                </Pressable>
              )}
            </View>
            {/* Quick date buttons */}
            <View className="flex-row gap-2">
              <Pressable
                onPress={() =>
                  setFormData({ ...formData, dueDate: Date.now() })
                }
                className="px-3 py-1.5 rounded-lg bg-surface border border-gray-700"
              >
                <Text className="text-xs text-gray-400">Today</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  setFormData({
                    ...formData,
                    dueDate: Date.now() + 86400000,
                  })
                }
                className="px-3 py-1.5 rounded-lg bg-surface border border-gray-700"
              >
                <Text className="text-xs text-gray-400">Tomorrow</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  setFormData({
                    ...formData,
                    dueDate: Date.now() + 7 * 86400000,
                  })
                }
                className="px-3 py-1.5 rounded-lg bg-surface border border-gray-700"
              >
                <Text className="text-xs text-gray-400">Next Week</Text>
              </Pressable>
            </View>
          </View>

          {/* Repeat */}
          <View className="gap-2">
            <View className="flex-row items-center gap-2">
              <Repeat size={14} color="#9CA3AF" />
              <Text className="text-xs font-bold text-gray-400 tracking-wider uppercase">
                Repeat
              </Text>
            </View>
            <Pressable
              onPress={() => setShowRepeatPicker(!showRepeatPicker)}
              className="bg-surface border border-gray-700 rounded-xl px-4 py-3"
            >
              <Text className="text-gray-300 text-sm">
                {REPEAT_OPTIONS.find((r) => r.value === formData.repeat)
                  ?.label ?? 'No Repeat'}
              </Text>
            </Pressable>
            {showRepeatPicker && (
              <View className="bg-surface border border-gray-700 rounded-xl p-2">
                {REPEAT_OPTIONS.map(({ value, label }) => (
                  <Pressable
                    key={value ?? 'none'}
                    onPress={() => {
                      setFormData({ ...formData, repeat: value });
                      setShowRepeatPicker(false);
                    }}
                    className={`px-3 py-2 rounded-lg ${
                      formData.repeat === value ? 'bg-accent' : ''
                    }`}
                  >
                    <Text
                      className={`text-sm ${
                        formData.repeat === value
                          ? 'text-black font-bold'
                          : 'text-gray-400'
                      }`}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Link to Goal */}
          {goals.length > 0 && (
            <View className="gap-2">
              <View className="flex-row items-center gap-2">
                <Target size={14} color="#9CA3AF" />
                <Text className="text-xs font-bold text-gray-400 tracking-wider uppercase">
                  Link to Goal
                </Text>
              </View>
              <Pressable
                onPress={() => setShowGoalPicker(!showGoalPicker)}
                className="bg-surface border border-gray-700 rounded-xl px-4 py-3"
              >
                <Text className="text-gray-300 text-sm">
                  {goals.find((g) => g.id === formData.linkedGoalId)?.text ??
                    'No linked goal'}
                </Text>
              </Pressable>
              {showGoalPicker && (
                <View className="bg-surface border border-gray-700 rounded-xl p-2 max-h-[200px]">
                  <ScrollView nestedScrollEnabled>
                    <Pressable
                      onPress={() => {
                        setFormData({
                          ...formData,
                          linkedGoalId: undefined,
                        });
                        setShowGoalPicker(false);
                      }}
                      className="px-3 py-2 rounded-lg"
                    >
                      <Text className="text-sm text-gray-500">
                        No linked goal
                      </Text>
                    </Pressable>
                    {goals
                      .filter((g) => g.id !== 'root')
                      .map((goal) => (
                        <Pressable
                          key={goal.id}
                          onPress={() => {
                            setFormData({
                              ...formData,
                              linkedGoalId: goal.id,
                            });
                            setShowGoalPicker(false);
                          }}
                          className={`px-3 py-2 rounded-lg ${
                            formData.linkedGoalId === goal.id
                              ? 'bg-accent'
                              : ''
                          }`}
                        >
                          <Text
                            className={`text-sm ${
                              formData.linkedGoalId === goal.id
                                ? 'text-black font-bold'
                                : 'text-gray-300'
                            }`}
                          >
                            {goal.text}
                          </Text>
                        </Pressable>
                      ))}
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          {/* Tags */}
          <View className="gap-2">
            <View className="flex-row items-center gap-2">
              <Tag size={14} color="#9CA3AF" />
              <Text className="text-xs font-bold text-gray-400 tracking-wider uppercase">
                Tags
              </Text>
            </View>
            <View className="flex-row gap-2">
              <TextInput
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={handleAddTag}
                placeholder="Add tag"
                placeholderTextColor="#4B5563"
                className="flex-1 bg-surface border border-gray-700 rounded-xl px-4 py-2 text-white text-sm"
                returnKeyType="done"
              />
              <Pressable
                onPress={handleAddTag}
                className="items-center justify-center px-4 bg-accent/20 border border-accent/30 rounded-xl"
              >
                <Text className="text-accent font-bold text-sm">Add</Text>
              </Pressable>
            </View>
            {formData.tags != null && formData.tags.length > 0 && (
              <View className="flex-row flex-wrap gap-2 mt-1">
                {formData.tags.map((tag, idx) => (
                  <View
                    key={idx}
                    className="flex-row items-center gap-1.5 px-3 py-1 bg-accent/10 border border-accent/20 rounded-full"
                  >
                    <Text className="text-sm text-accent">#{tag}</Text>
                    <Pressable onPress={() => handleRemoveTag(tag)}>
                      <X size={12} color="#EF4444" />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Notes */}
          <View className="gap-2">
            <Text className="text-xs font-bold text-gray-400 tracking-wider uppercase">
              Notes
            </Text>
            <TextInput
              value={formData.note ?? ''}
              onChangeText={(note) => setFormData({ ...formData, note })}
              placeholder="Additional notes..."
              placeholderTextColor="#4B5563"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              className="bg-surface border border-gray-700 rounded-xl px-4 py-3 text-white text-sm min-h-[100px]"
            />
          </View>
        </ScrollView>

        {/* Footer */}
        <View className="flex-row items-center justify-between px-5 py-4 border-t border-gray-700/50">
          {todo && onDelete ? (
            <Pressable
              onPress={() => {
                onDelete(todo.id);
                onClose();
              }}
              className="flex-row items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl"
            >
              <Trash2 size={16} color="#F87171" />
              <Text className="text-red-400 font-bold">Delete</Text>
            </Pressable>
          ) : (
            <View />
          )}

          <View className="flex-row gap-3">
            <Pressable
              onPress={onClose}
              className="px-5 py-2.5 bg-surface border border-gray-700 rounded-xl"
            >
              <Text className="text-gray-400 font-bold">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={!formData.text?.trim()}
              className={`flex-row items-center gap-2 px-5 py-2.5 rounded-xl ${
                formData.text?.trim()
                  ? 'bg-accent'
                  : 'bg-gray-700 opacity-50'
              }`}
            >
              <Save size={16} color={formData.text?.trim() ? '#000' : '#666'} />
              <Text
                className={`font-bold ${
                  formData.text?.trim() ? 'text-black' : 'text-gray-500'
                }`}
              >
                {todo ? 'Update' : 'Create'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default TodoEditModal;
