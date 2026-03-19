import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  Text,
  View,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { X } from 'lucide-react-native';
import CoachChat from './CoachChat';

interface CoachModalProps {
  visible: boolean;
  onClose: () => void;
  sourceTab?: string;
  sourceContext?: { nodeId?: string; nodeText?: string };
}

const CoachModal: React.FC<CoachModalProps> = ({
  visible,
  onClose,
  sourceTab,
  sourceContext,
}) => {
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset before opening
      scaleAnim.setValue(0.3);
      opacityAnim.setValue(0);

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 8,
        }),
        Animated.spring(opacityAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 8,
        }),
      ]).start();
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.3,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      {/* Background overlay */}
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Animated.View
          style={[
            styles.overlayBackground,
            { opacity: opacityAnim },
          ]}
        />
      </Pressable>

      {/* Modal card */}
      <Animated.View
        style={[
          styles.card,
          {
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.cardInner}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>코치</Text>
            <Pressable
              onPress={handleClose}
              hitSlop={12}
              style={styles.closeButton}
            >
              <X size={22} color="#94A3B8" />
            </Pressable>
          </View>

          {/* Chat body */}
          <CoachChat sourceTab={sourceTab} sourceContext={sourceContext} />
        </View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  card: {
    position: 'absolute',
    top: 60,
    bottom: 100,
    left: 16,
    right: 16,
  },
  cardInner: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  closeButton: {
    padding: 4,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  placeholderText: {
    fontSize: 16,
    color: '#94A3B8',
  },
  contextBadge: {
    marginTop: 16,
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  contextLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  contextText: {
    fontSize: 14,
    color: '#93C5FD',
  },
});

export default CoachModal;
