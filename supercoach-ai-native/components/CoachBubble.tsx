import React from 'react';
import { Pressable, View } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';

interface CoachBubbleProps {
  hasUnread?: boolean;
}

const CoachBubble: React.FC<CoachBubbleProps> = ({ hasUnread = false }) => {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push('/coach-chat')}
      className="absolute bottom-24 right-5 z-50 w-14 h-14 rounded-full bg-blue-500 items-center justify-center shadow-lg"
      style={{ elevation: 8 }}
    >
      <MessageCircle size={26} color="#fff" />
      {hasUnread && (
        <View className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-white" />
      )}
    </Pressable>
  );
};

export default CoachBubble;
