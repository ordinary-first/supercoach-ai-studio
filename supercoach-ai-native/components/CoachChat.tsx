import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  FadeIn,
  SlideInDown,
  SlideInUp,
  Easing,
} from 'react-native-reanimated';
import { Send, Bot } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { sendChatMessage } from '../services/aiService';
import { getCoachMode, buildSystemPrompt } from '../services/coachModes';
import { TOOL_CALLING_PROMPT, parseToolCalls } from '../services/coachTools';
import type { ChatMessage } from '../shared/types';

interface CoachChatProps {
  sourceTab?: string;
  sourceContext?: { nodeId?: string; nodeText?: string };
}

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Typing indicator with 3 bouncing dots */
const TypingIndicator: React.FC = () => {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    const bounce = (sv: Animated.SharedValue<number>, delay: number) => {
      sv.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(-6, { duration: 300, easing: Easing.out(Easing.cubic) }),
            withTiming(0, { duration: 300, easing: Easing.in(Easing.cubic) }),
          ),
          -1,
          false,
        ),
      );
    };
    bounce(dot1, 0);
    bounce(dot2, 150);
    bounce(dot3, 300);
  }, []);

  const s1 = useAnimatedStyle(() => ({ transform: [{ translateY: dot1.value }] }));
  const s2 = useAnimatedStyle(() => ({ transform: [{ translateY: dot2.value }] }));
  const s3 = useAnimatedStyle(() => ({ transform: [{ translateY: dot3.value }] }));

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      className="mx-4 my-1 items-start"
    >
      <View className="flex-row items-center gap-1.5 rounded-2xl rounded-bl-md px-5 py-4"
        style={{ backgroundColor: 'rgba(26,31,46,0.9)' }}>
        <Bot size={14} color="#71B7FF" />
        <View className="flex-row items-center gap-1 ml-1">
          <Animated.View style={s1} className="w-2 h-2 rounded-full bg-neutral-400" />
          <Animated.View style={s2} className="w-2 h-2 rounded-full bg-neutral-400" />
          <Animated.View style={s3} className="w-2 h-2 rounded-full bg-neutral-400" />
        </View>
      </View>
    </Animated.View>
  );
};

/** Animated message bubble */
const MessageBubble: React.FC<{ item: ChatMessage }> = React.memo(({ item }) => {
  const isUser = item.sender === 'user';

  return (
    <Animated.View
      entering={isUser
        ? SlideInDown.duration(300).springify().damping(15)
        : FadeIn.duration(400).delay(100)
      }
      className={`mx-4 my-1 ${isUser ? 'items-end' : 'items-start'}`}
    >
      {!isUser && (
        <View className="flex-row items-center gap-1.5 mb-1 ml-1">
          <Bot size={12} color="#71B7FF" />
          <Text className="text-[10px] text-[#71B7FF] font-bold">Coach</Text>
        </View>
      )}
      <View
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-[#71B7FF] rounded-br-md'
            : 'rounded-bl-md border border-white/5'
        }`}
        style={isUser ? {
          shadowColor: '#71B7FF',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 4,
        } : {
          backgroundColor: 'rgba(26,31,46,0.9)',
        }}
      >
        <Text className={`text-sm leading-5 ${isUser ? 'text-[#0A0E1A] font-medium' : 'text-neutral-200'}`}>
          {item.text}
        </Text>
      </View>
      <Text className={`text-[9px] mt-1 mx-2 ${isUser ? 'text-neutral-600' : 'text-neutral-600'}`}>
        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </Animated.View>
  );
});

const CoachChat: React.FC<CoachChatProps> = ({ sourceTab, sourceContext }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const sendScale = useSharedValue(1);

  const modeConfig = getCoachMode(sourceTab, sourceContext);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendScale.value = withSequence(
      withSpring(0.85, { damping: 4 }),
      withSpring(1),
    );

    const userMessage: ChatMessage = {
      id: generateMessageId(),
      sender: 'user',
      text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const history = messages.map((m) => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }],
      }));

      const systemPrompt = buildSystemPrompt(modeConfig);
      const topicDirective = `${systemPrompt}\n${TOOL_CALLING_PROMPT}`;

      const response = await sendChatMessage(
        history,
        text,
        null,
        { shortTerm: null, midTerm: null, longTerm: null },
        '',
        '',
        sourceTab,
        undefined,
        undefined,
        topicDirective,
      );

      const aiText =
        response?.candidates?.[0]?.content?.parts?.[0]?.text || '응답을 받지 못했습니다.';

      const { text: cleanText, toolCalls } = parseToolCalls(aiText);

      if (toolCalls.length > 0) {
        console.log('Tool calls detected:', toolCalls);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const aiMessage: ChatMessage = {
        id: generateMessageId(),
        sender: 'ai',
        text: cleanText || aiText,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const errorMessage: ChatMessage = {
        id: generateMessageId(),
        sender: 'ai',
        text: '죄송합니다. 오류가 발생했습니다. 다시 시도해주세요.',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [inputText, isLoading, messages, modeConfig, sourceTab]);

  const sendButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }));

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => <MessageBubble item={item} />,
    [],
  );

  const canSend = inputText.trim().length > 0 && !isLoading;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#0A0E1A]"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Mode indicator */}
      <View className="px-4 py-2.5 border-b border-white/5 flex-row items-center gap-2">
        <Bot size={14} color="#71B7FF" />
        <Text className="text-xs text-[#71B7FF] font-bold">{modeConfig.label}</Text>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        className="flex-1"
        contentContainerStyle={{ paddingVertical: 12 }}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <View className="w-16 h-16 rounded-2xl items-center justify-center mb-4"
              style={{ backgroundColor: 'rgba(113,183,255,0.08)' }}>
              <Bot size={28} color="#71B7FF" />
            </View>
            <Text className="text-neutral-400 text-sm font-medium">
              코치에게 무엇이든 물어보세요
            </Text>
            {sourceContext?.nodeText && (
              <Text className="text-[#71B7FF]/60 text-xs mt-2">
                선택된 목표: {sourceContext.nodeText}
              </Text>
            )}
          </View>
        }
      />

      {/* Typing indicator */}
      {isLoading && <TypingIndicator />}

      {/* Input */}
      <Animated.View
        entering={SlideInUp.duration(300).delay(200)}
        className="flex-row items-end px-3 py-2 border-t border-white/5"
      >
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder="메시지를 입력하세요..."
          placeholderTextColor="#4B5563"
          className="flex-1 rounded-2xl px-4 py-2.5 text-white text-sm mr-2 max-h-24"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
          multiline
          returnKeyType="default"
        />
        <Animated.View style={sendButtonStyle}>
          <TouchableOpacity
            onPress={handleSend}
            disabled={!canSend}
            className={`w-10 h-10 rounded-full items-center justify-center ${
              canSend ? 'bg-[#71B7FF]' : ''
            }`}
            style={!canSend ? { backgroundColor: 'rgba(255,255,255,0.06)' } : {
              shadowColor: '#71B7FF',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            }}
            activeOpacity={0.7}
          >
            <Send size={18} color={canSend ? '#0A0E1A' : '#4B5563'} />
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
};

export default CoachChat;
