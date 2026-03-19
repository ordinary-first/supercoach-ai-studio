import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Send } from 'lucide-react-native';
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

const CoachChat: React.FC<CoachChatProps> = ({ sourceTab, sourceContext }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const modeConfig = getCoachMode(sourceTab, sourceContext);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

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
      // Build history for API
      const history = messages.map((m) => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }],
      }));

      // Include mode system prompt as topic directive
      const systemPrompt = buildSystemPrompt(modeConfig);
      const topicDirective = `${systemPrompt}\n${TOOL_CALLING_PROMPT}`;

      const response = await sendChatMessage(
        history,
        text,
        null, // profile - TODO: connect to auth
        { shortTerm: null, midTerm: null, longTerm: null }, // memory - TODO: connect
        '', // goalContext
        '', // todoContext
        sourceTab,
        undefined, // userId
        undefined, // goalCount
        topicDirective,
      );

      const aiText =
        response?.candidates?.[0]?.content?.parts?.[0]?.text || '응답을 받지 못했습니다.';

      // Parse tool calls from response
      const { text: cleanText, toolCalls } = parseToolCalls(aiText);

      // Execute tool calls if any
      if (toolCalls.length > 0) {
        // TODO: Execute tool calls via coachToolExecutor
        // For now just log them
        console.log('Tool calls detected:', toolCalls);
      }

      const aiMessage: ChatMessage = {
        id: generateMessageId(),
        sender: 'ai',
        text: cleanText || aiText,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
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

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const isUser = item.sender === 'user';
      return (
        <View
          className={`mx-4 my-1 ${isUser ? 'items-end' : 'items-start'}`}
        >
          <View
            className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              isUser ? 'bg-blue-500 rounded-br-md' : 'bg-slate-700 rounded-bl-md'
            }`}
          >
            <Text className="text-white text-sm leading-5">{item.text}</Text>
          </View>
        </View>
      );
    },
    [],
  );

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Mode indicator */}
      <View className="px-4 py-2 border-b border-slate-700/30">
        <Text className="text-xs text-blue-400">{modeConfig.label}</Text>
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
            <Text className="text-slate-500 text-sm">
              코치에게 무엇이든 물어보세요
            </Text>
            {sourceContext?.nodeText && (
              <Text className="text-blue-400/70 text-xs mt-2">
                선택된 목표: {sourceContext.nodeText}
              </Text>
            )}
          </View>
        }
      />

      {/* Loading indicator */}
      {isLoading && (
        <View className="px-4 py-2 flex-row items-center">
          <ActivityIndicator size="small" color="#5AA9FF" />
          <Text className="text-slate-400 text-xs ml-2">답변 작성 중...</Text>
        </View>
      )}

      {/* Input */}
      <View className="flex-row items-end px-3 py-2 border-t border-slate-700/30">
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder="메시지를 입력하세요..."
          placeholderTextColor="#64748b"
          className="flex-1 bg-slate-700/50 rounded-2xl px-4 py-2.5 text-white text-sm mr-2 max-h-24"
          multiline
          returnKeyType="default"
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={!inputText.trim() || isLoading}
          className={`w-10 h-10 rounded-full items-center justify-center ${
            inputText.trim() && !isLoading ? 'bg-blue-500' : 'bg-slate-700'
          }`}
          activeOpacity={0.7}
        >
          <Send size={18} color={inputText.trim() && !isLoading ? '#fff' : '#64748b'} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

export default CoachChat;
