import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  withRepeat,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ShieldCheck, Chrome, User, AlertTriangle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { loginAnonymously, loginWithGoogle } from '../../services/firebaseService';
import { useTranslation } from '../../shared/i18n/useTranslation';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // --- Entrance animations ---
  const bgGlow = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(30);
  const cardOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(40);
  const buttonScale = useSharedValue(0.9);
  const pulseValue = useSharedValue(0);

  useEffect(() => {
    // Background glow
    bgGlow.value = withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) });
    // Title entrance
    titleOpacity.value = withDelay(200, withTiming(1, { duration: 800 }));
    titleTranslateY.value = withDelay(200, withSpring(0, { damping: 15, stiffness: 90 }));
    // Card entrance
    cardOpacity.value = withDelay(500, withTiming(1, { duration: 800 }));
    cardTranslateY.value = withDelay(500, withSpring(0, { damping: 15, stiffness: 80 }));
    // Buttons pop
    buttonScale.value = withDelay(800, withSpring(1, { damping: 12, stiffness: 100 }));
    // Subtle pulse on glow
    pulseValue.value = withDelay(1500, withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    ));
  }, []);

  const bgGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(bgGlow.value, [0, 1], [0, 0.15]),
    transform: [{ scale: interpolate(pulseValue.value, [0, 1], [1, 1.08]) }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslateY.value }],
  }));

  const buttonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handleGoogleLogin = useCallback(async () => {
    setErrorMessage(null);
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await loginWithGoogle();
      if (result?.user) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage(
        error?.message ||
          (language === 'ko'
            ? '로그인 중 오류가 발생했습니다.'
            : 'An error occurred during login.'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [router, language]);

  const handleAnonymousLogin = useCallback(async () => {
    setErrorMessage(null);
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const user = await loginAnonymously();
      if (user) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(tabs)');
      } else {
        setErrorMessage(
          language === 'ko'
            ? '게스트 로그인에 실패했습니다.'
            : 'Anonymous login failed. Please try again.',
        );
      }
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage(error?.message || 'Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [router, language]);

  return (
    <View className="flex-1 bg-[#0A0E1A]">
      {/* Radial glow background */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: SCREEN_H * 0.15,
            left: SCREEN_W * 0.5 - SCREEN_W * 0.7,
            width: SCREEN_W * 1.4,
            height: SCREEN_W * 1.4,
            borderRadius: SCREEN_W * 0.7,
          },
          bgGlowStyle,
        ]}
      >
        <LinearGradient
          colors={['#5AA9FF', '#3B82F6', 'transparent']}
          style={{ width: '100%', height: '100%', borderRadius: SCREEN_W * 0.7 }}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </Animated.View>

      {/* Content */}
      <View className="flex-1 justify-center items-center px-8">
        {/* Title */}
        <Animated.View style={titleStyle} className="items-center mb-10">
          <Text
            className="text-5xl font-black tracking-tighter text-white"
            style={{ fontStyle: 'italic' }}
          >
            SECRET{' '}
            <Text className="text-[#71B7FF]">COACH</Text>
          </Text>
          <View className="flex-row items-center mt-3 gap-2">
            <ShieldCheck size={12} color="#71B7FF" />
            <Text className="text-[10px] text-neutral-400 font-bold tracking-[3px] uppercase">
              Neural Goal Setting System
            </Text>
          </View>
        </Animated.View>

        {/* Card */}
        <Animated.View
          style={cardStyle}
          className="w-full max-w-sm"
        >
          <View
            className="rounded-[32px] border border-white/10 p-7 overflow-hidden"
            style={{
              backgroundColor: 'rgba(26, 31, 46, 0.85)',
            }}
          >
            {/* Card header */}
            <View className="items-center mb-6">
              <Text className="text-[10px] font-bold text-[#71B7FF] uppercase tracking-[3px]">
                System Authorization
              </Text>
              <Text className="text-[11px] text-neutral-400 mt-2 text-center leading-4">
                {language === 'ko'
                  ? 'Google 계정으로 로그인해\n목표 데이터를 클라우드에 저장하세요.'
                  : 'Sign in with Google to save\nyour goal data to the cloud.'}
              </Text>
            </View>

            {/* Buttons */}
            <Animated.View style={buttonAnimStyle} className="gap-3">
              <TouchableOpacity
                onPress={handleGoogleLogin}
                disabled={isLoading}
                activeOpacity={0.85}
                className="w-full flex-row items-center justify-center rounded-full bg-white py-4 gap-3"
                style={{
                  shadowColor: '#71B7FF',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: isLoading ? 0 : 0.3,
                  shadowRadius: 16,
                  elevation: 8,
                }}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Chrome size={18} color="#000" />
                )}
                <Text className="text-sm font-black text-black uppercase tracking-[2px]">
                  {isLoading ? 'Redirecting...' : 'Google Login'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleAnonymousLogin}
                disabled={isLoading}
                activeOpacity={0.85}
                className="w-full flex-row items-center justify-center rounded-full border border-white/20 py-4 gap-3"
              >
                <User size={16} color="#9CA3AF" />
                <Text className="text-sm font-bold text-neutral-400 uppercase tracking-[2px]">
                  {language === 'ko' ? '게스트 입장' : 'Continue as Guest'}
                </Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Error message */}
            {errorMessage && (
              <View className="mt-4 p-4 rounded-2xl border border-red-500/20 bg-red-500/10 flex-row items-start gap-3">
                <AlertTriangle size={14} color="#EF4444" />
                <Text className="text-[10px] text-red-300 flex-1 leading-4 font-mono">
                  {errorMessage}
                </Text>
              </View>
            )}

            {/* Footer */}
            <View className="mt-6 pt-4 border-t border-white/5">
              <Text className="text-[9px] text-neutral-500 text-center leading-4">
                {language === 'ko'
                  ? '로그인 시 Firebase 인증 상태가 유지됩니다.\n사용자 데이터는 백엔드에 안전하게 저장됩니다.'
                  : 'Your device maintains Firebase auth state after login.\nUser data is stored securely in the backend.'}
              </Text>
              <View className="flex-row items-center justify-center gap-3 mt-3">
                <Text className="text-[9px] font-bold text-neutral-500 uppercase tracking-[2px]">
                  Terms
                </Text>
                <Text className="text-neutral-700">|</Text>
                <Text className="text-[9px] font-bold text-neutral-500 uppercase tracking-[2px]">
                  Privacy
                </Text>
                <Text className="text-neutral-700">|</Text>
                <Text className="text-[9px] font-bold text-neutral-500 uppercase tracking-[2px]">
                  Refunds
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}
