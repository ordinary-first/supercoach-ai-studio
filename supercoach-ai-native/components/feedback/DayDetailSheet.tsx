import React, { useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { X, Pencil, Check, Circle, ChevronDown, ChevronUp, Trophy } from 'lucide-react-native';
import { formatDayLabel, formatDateShort } from '../../shared/feedbackDateUtils';
import type { FeedbackCard } from '../../shared/types';
import type { TranslationStrings } from '../../shared/i18n/types';

interface DayDetailSheetProps {
  date: Date;
  card: FeedbackCard | null;
  t: TranslationStrings;
  onClose: () => void;
  onSave: (card: FeedbackCard) => void;
}

export const DayDetailSheet: React.FC<DayDetailSheetProps> = ({
  date,
  card,
  t,
  onClose,
  onSave,
}) => {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['85%'], []);

  const [isEditing, setIsEditing] = useState(false);
  const [showIncomplete, setShowIncomplete] = useState(false);
  const [editComment, setEditComment] = useState(card?.coachComment ?? '');
  const [editNote, setEditNote] = useState(card?.userNote ?? '');
  const [editCompleted, setEditCompleted] = useState<string[]>(card?.completedTodos ?? []);
  const [editIncomplete, setEditIncomplete] = useState<string[]>(card?.incompleteTodos ?? []);

  const dayName = formatDayLabel(date, t);
  const dateStr = formatDateShort(date);
  const title = t.feedback.dayWins.replace('{day}', dayName);

  const handleSave = useCallback(() => {
    if (!card) return;
    const updated: FeedbackCard = {
      ...card,
      completedTodos: editCompleted,
      incompleteTodos: editIncomplete,
      coachComment: editComment || undefined,
      userNote: editNote || undefined,
      userEdited: true,
      updatedAt: Date.now(),
    };
    onSave(updated);
    setIsEditing(false);
  }, [card, editCompleted, editIncomplete, editComment, editNote, onSave]);

  const toggleItem = (item: string, fromCompleted: boolean) => {
    if (!isEditing) return;
    if (fromCompleted) {
      setEditCompleted((prev) => prev.filter((i) => i !== item));
      setEditIncomplete((prev) => [...prev, item]);
    } else {
      setEditIncomplete((prev) => prev.filter((i) => i !== item));
      setEditCompleted((prev) => [...prev, item]);
    }
  };

  const noData = !card || (card.completedTodos.length === 0 && card.incompleteTodos.length === 0);

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={{ backgroundColor: '#1A1F2E' }}
      handleIndicatorStyle={{ backgroundColor: '#555', width: 40 }}
    >
      <BottomSheetView className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-3">
          <View>
            <Text className="text-base font-bold text-white">{title}</Text>
            <Text className="text-[11px] text-gray-500 mt-0.5">{dateStr}</Text>
          </View>
          <View className="flex-row items-center gap-2">
            {!isEditing && card && (
              <Pressable
                onPress={() => setIsEditing(true)}
                className="p-2 rounded-full"
              >
                <Pencil size={14} color="#888" />
              </Pressable>
            )}
            <Pressable onPress={onClose} className="p-2 rounded-full">
              <X size={16} color="#888" />
            </Pressable>
          </View>
        </View>

        {/* Content */}
        <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 100 }}>
          {noData ? (
            <View className="items-center justify-center py-12">
              <Text className="text-[13px] text-gray-500 text-center">
                {t.feedback.emptyRecordHint}
              </Text>
            </View>
          ) : (
            <View className="gap-5">
              {/* Completed */}
              <View>
                <View className="flex-row items-center gap-2 mb-3">
                  <Trophy size={14} color="#22c55e" />
                  <Text className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider">
                    {t.feedback.completed}
                  </Text>
                </View>
                <View className="gap-2">
                  {(isEditing ? editCompleted : card?.completedTodos ?? []).map((item, i) => (
                    <Pressable
                      key={`c-${i}`}
                      onPress={() => toggleItem(item, true)}
                      className="flex-row items-start gap-2.5"
                    >
                      <Check size={12} color="#22c55e" />
                      <Text className="text-[13px] text-white leading-snug flex-1">
                        {item}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Incomplete Toggle */}
              {(isEditing ? editIncomplete : card?.incompleteTodos ?? []).length > 0 && (
                <View>
                  <Pressable
                    onPress={() => setShowIncomplete(!showIncomplete)}
                    className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface self-start border border-white/10"
                  >
                    <Text className="text-[11px] text-gray-500">
                      {showIncomplete ? t.feedback.hideIncomplete : t.feedback.showIncomplete}
                    </Text>
                    {showIncomplete ? (
                      <ChevronUp size={12} color="#888" />
                    ) : (
                      <ChevronDown size={12} color="#888" />
                    )}
                  </Pressable>

                  {showIncomplete && (
                    <View className="gap-2 mt-3">
                      {(isEditing ? editIncomplete : card?.incompleteTodos ?? []).map((item, i) => (
                        <Pressable
                          key={`i-${i}`}
                          onPress={() => toggleItem(item, false)}
                          className="flex-row items-start gap-2.5"
                        >
                          <Circle size={12} color="#666" />
                          <Text className="text-[13px] text-gray-500 leading-snug flex-1">
                            {item}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Coach Comment */}
              <View className="border-t border-white/10 pt-4">
                <Text className="text-[11px] text-gray-500 mb-2">
                  {t.feedback.coachComment}
                </Text>
                {isEditing ? (
                  <TextInput
                    value={editComment}
                    onChangeText={setEditComment}
                    className="bg-background border border-white/10 rounded-xl px-3 py-2 text-[13px] text-white"
                    multiline
                    numberOfLines={2}
                    placeholder="Coach comment..."
                    placeholderTextColor="#555"
                  />
                ) : (
                  card?.coachComment ? (
                    <Text className="text-[13px] text-gray-400 italic">
                      "{card.coachComment}"
                    </Text>
                  ) : null
                )}
              </View>

              {/* User Note */}
              <View className="border-t border-white/10 pt-4">
                <Text className="text-[11px] text-gray-500 mb-2">
                  {t.feedback.userNote}
                </Text>
                {isEditing ? (
                  <TextInput
                    value={editNote}
                    onChangeText={setEditNote}
                    className="bg-background border border-white/10 rounded-xl px-3 py-2.5 text-[13px] text-white leading-relaxed"
                    multiline
                    numberOfLines={4}
                    placeholder={t.feedback.userNotePlaceholder}
                    placeholderTextColor="#555"
                  />
                ) : (
                  card?.userNote ? (
                    <Text className="text-[13px] text-gray-400 leading-relaxed">
                      {card.userNote}
                    </Text>
                  ) : null
                )}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Save Button */}
        {isEditing && (
          <View className="px-5 py-3 pb-8">
            <Pressable
              onPress={handleSave}
              className="w-full py-3 rounded-2xl bg-accent items-center"
            >
              <Text className="text-white font-bold text-sm">{t.feedback.save}</Text>
            </Pressable>
          </View>
        )}
      </BottomSheetView>
    </BottomSheet>
  );
};
