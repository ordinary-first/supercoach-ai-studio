import React, { useEffect } from 'react';
import { Dimensions, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
  withRepeat,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ShieldCheck, ArrowRight, Sparkles, Target, MessageSquare } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTranslation } from '../../shared/i18n/useTranslation';

const { width: SW, height: SH } = Dimensions.get('window');
const ACCENT = '#71B7FF';

const FEATURES = [
  { icon: Target, labelEn: 'AI Goal Decomposition', labelKo: 'AI 목표 분해' },
  { icon: Sparkles, labelEn: 'Daily Personalized Feedback', labelKo: '매일 맞춤형 피드백' },
  { icon: MessageSquare, labelEn: 'Coaching Conversations', labelKo: 'AI 코칭 대화' },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { language } = useTranslation();

  const bgGlow = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const logoY = useSharedValue(40);
  const featuresOpacity = useSharedValue(0);
  const featuresY = useSharedValue(30);
  const ctaOpacity = useSharedValue(0);
  const ctaScale = useSharedValue(0.85);
  const pulse = useSharedValue(0);

  useEffect(() => {
    bgGlow.value = withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) });
    logoOpacity.value = withDelay(300, withTiming(1, { duration: 700 }));
    logoY.value = withDelay(300, withSpring(0, { damping: 14, stiffness: 80 }));
    featuresOpacity.value = withDelay(700, withTiming(1, { duration: 600 }));
    featuresY.value = withDelay(700, withSpring(0, { damping: 14, stiffness: 80 }));
    ctaOpacity.value = withDelay(1100, withTiming(1, { duration: 600 }));
    ctaScale.value = withDelay(1100, withSpring(1, { damping: 10, stiffness: 90 }));
    pulse.value = withDelay(1800, withRepeat(
      withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    ));
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(bgGlow.value, [0, 1], [0, 0.12]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.06]) }],
  }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ translateY: logoY.value }],
  }));
  const featStyle = useAnimatedStyle(() => ({
    opacity: featuresOpacity.value,
    transform: [{ translateY: featuresY.value }],
  }));
  const ctaStyle = useAnimatedStyle(() => ({
    opacity: ctaOpacity.value,
    transform: [{ scale: ctaScale.value }],
  }));

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(onboarding)/plan-selection');
  };

  return (
    <View className="flex-1 bg-[#0A0E1A]">
      {/* Background glow */}
      <Animated.View
        style={[{
          position: 'absolute', top: SH * 0.1,
          left: SW * 0.5 - SW * 0.6, width: SW * 1.2, height: SW * 1.2,
          borderRadius: SW * 0.6,
        }, glowStyle]}
      >
        <LinearGradient
          colors={['#5AA9FF', '#3B82F6', 'transparent']}
          style={{ width: '100%', height: '100%', borderRadius: SW * 0.6 }}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        />
      </Animated.View>

      <View className="flex-1 justify-center items-center px-8">
        {/* Logo + Title */}
        <Animated.View style={logoStyle} className="items-center mb-12">
          <View className="w-20 h-20 rounded-full border-2 border-[#71B7FF]/40 items-center justify-center mb-6"
            style={{ backgroundColor: 'rgba(113,183,255,0.08)' }}>
            <ShieldCheck size={36} color={ACCENT} />
          </View>
          <Text className="text-4xl font-black text-white tracking-tighter" style={{ fontStyle: 'italic' }}>
            SECRET <Text className="text-[#71B7FF]">COACH</Text>
          </Text>
          <Text className="text-sm text-neutral-400 mt-2 text-center">
            {language === 'ko'
              ? '당신만의 AI 라이프 코치'
              : 'Your Personal AI Life Coach'}
          </Text>
        </Animated.View>

        {/* Feature highlights */}
        <Animated.View style={featStyle} className="w-full max-w-sm gap-4 mb-12">
          {FEATURES.map((feat, i) => {
            const Icon = feat.icon;
            return (
              <View key={i} className="flex-row items-center gap-4 px-2">
                <View className="w-10 h-10 rounded-xl items-center justify-center"
                  style={{ backgroundColor: 'rgba(113,183,255,0.1)' }}>
                  <Icon size={20} color={ACCENT} />
                </View>
                <Text className="text-sm text-neutral-300 font-medium flex-1">
                  {language === 'ko' ? feat.labelKo : feat.labelEn}
                </Text>
              </View>
            );
          })}
        </Animated.View>

        {/* CTA */}
        <Animated.View style={ctaStyle} className="w-full max-w-sm">
          <TouchableOpacity
            onPress={handleContinue}
            activeOpacity={0.85}
            className="w-full flex-row items-center justify-center rounded-full bg-white py-4 gap-3"
            style={{
              shadowColor: '#71B7FF', shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.3, shadowRadius: 20, elevation: 8,
            }}
          >
            <Text className="text-sm font-black text-[#0A0E1A] uppercase tracking-[2px]">
              {language === 'ko' ? '시작하기' : 'Get Started'}
            </Text>
            <ArrowRight size={16} color="#0A0E1A" />
          </TouchableOpacity>

          <Text className="text-[11px] text-neutral-500 text-center mt-4">
            {language === 'ko' ? '3일 무료 체험 · 언제든 취소 가능' : '3-day free trial · Cancel anytime'}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}
