import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useState,
} from 'react';
import { Pressable, View } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import CoachModal from './CoachModal';

export interface CoachBubbleRef {
  openWithContext: (context: { nodeId?: string; nodeText?: string }) => void;
}

interface CoachBubbleProps {
  hasUnread?: boolean;
  sourceTab?: string;
}

const CoachBubble = forwardRef<CoachBubbleRef, CoachBubbleProps>(
  ({ hasUnread = false, sourceTab }, ref) => {
    const [modalVisible, setModalVisible] = useState(false);
    const [sourceContext, setSourceContext] = useState<{
      nodeId?: string;
      nodeText?: string;
    }>();

    const openWithContext = useCallback(
      (context: { nodeId?: string; nodeText?: string }) => {
        setSourceContext(context);
        setModalVisible(true);
      },
      [],
    );

    useImperativeHandle(ref, () => ({ openWithContext }), [openWithContext]);

    const handleBubblePress = () => {
      setSourceContext(undefined);
      setModalVisible(true);
    };

    const handleModalClose = () => {
      setModalVisible(false);
    };

    return (
      <>
        <Pressable
          onPress={handleBubblePress}
          className="absolute bottom-24 right-5 z-50 w-14 h-14 rounded-full bg-blue-500 items-center justify-center shadow-lg"
          style={{ elevation: 8 }}
        >
          <MessageCircle size={26} color="#fff" />
          {hasUnread && (
            <View className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-white" />
          )}
        </Pressable>

        <CoachModal
          visible={modalVisible}
          onClose={handleModalClose}
          sourceTab={sourceTab}
          sourceContext={sourceContext}
        />
      </>
    );
  },
);

CoachBubble.displayName = 'CoachBubble';

export default CoachBubble;
