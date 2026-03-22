import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
  FadeIn,
} from 'react-native-reanimated';
import { Check, Crown, Sparkles, ArrowRight, AlertTriangle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { usePurchases } from '../../hooks/usePurchases';
import { completeOnboarding } from '../../services/firebaseService';
import type { UserProfile } from '../../shared/types';

type PlanTier = NonNullable<UserProfile['billingPlan']>;

interface PlanItem {
  plan: PlanTier;
  label: string;
  price: string;
  badge?: string;
  features: string[];
  cta: string;
  highlight: boolean;
}

const ACCENT = '#71B7FF';
const BG = '#0A0E1A';
const MUTED = '#6B7280';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function PlanSelectionScreen() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const { offerings, purchase } = usePurchases();
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>('explorer');
  const [loadingPlan, setLoadingPlan] = useState<PlanTier | null>(null);
  const [error, setError] = useState('');

  // Entrance animations
  const headerOpacity = useSharedValue(0);
  const headerY = useSharedValue(20);
  const cardsOpacity = useSharedValue(0);
  const cardsY = useSharedValue(30);

  useEffect(() => {
    headerOpacity.value = withDelay(100, withTiming(1, { duration: 500 }));
    headerY.value = withDelay(100, withSpring(0, { damping: 15, stiffness: 90 }));
    cardsOpacity.value = withDelay(400, withTiming(1, { duration: 600 }));
    cardsY.value = withDelay(400, withSpring(0, { damping: 14, stiffness: 80 }));
  }, []);

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerY.value }],
  }));
  const cardsStyle = useAnimatedStyle(() => ({
    opacity: cardsOpacity.value,
    transform: [{ translateY: cardsY.value }],
  }));

  const PLANS: PlanItem[] = [
    {
      plan: 'explorer',
      label: 'Explorer',
      price: t.onboarding.free,
      badge: t.onboarding.trialBadge,
      features: t.onboarding.planFeatures.explorer,
      cta: t.onboarding.startFree,
      highlight: true,
    },
    {
      plan: 'essential',
      label: 'Essential',
      price: language === 'ko' ? '$9.99/월' : '$9.99/mo',
      features: t.onboarding.planFeatures.essential,
      cta: t.onboarding.startNow,
      highlight: false,
    },
    {
      plan: 'visionary',
      label: 'Visionary',
      price: language === 'ko' ? '$19.99/월' : '$19.99/mo',
      features: t.onboarding.planFeatures.visionary,
      cta: t.onboarding.startNow,
      highlight: false,
    },
    {
      plan: 'master',
      label: 'Master',
      price: language === 'ko' ? '$49.99/월' : '$49.99/mo',
      features: t.onboarding.planFeatures.master,
      cta: t.onboarding.startNow,
      highlight: false,
    },
  ];

  const handleSelect = async (plan: PlanTier) => {
    if (loadingPlan) return;
    setLoadingPlan(plan);
    setError('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (plan === 'explorer') {
        // Free plan — complete onboarding and go to main app
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(tabs)');
      } else {
        // Paid plan — use RevenueCat
        const packages = offerings?.current?.availablePackages;
        const pkg = packages?.find((p) => p.identifier === plan);
        if (pkg) {
          const info = await purchase(pkg);
          if (info) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.replace('/(tabs)');
          }
        } else {
          // Fallback if offerings not loaded
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.replace('/(tabs)');
        }
      }
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof Error ? err.message : t.onboarding.error);
      setLoadingPlan(null);
    }
  };

  const handlePlanTap = (plan: PlanTier) => {
    Haptics.selectionAsync();
    setSelectedPlan(plan);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0A0E1A]">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View style={headerStyle} className="items-center pt-10 pb-6 px-6">
          <View
            className="w-16 h-16 rounded-full mb-4 border-2 border-[#71B7FF]/40 items-center justify-center"
            style={{ backgroundColor: 'rgba(113,183,255,0.08)' }}
          >
            <Sparkles size={28} color={ACCENT} />
          </View>
          <Text className="text-2xl font-bold text-white mb-1">
            {t.onboarding.selectPlan}
          </Text>
          <Text className="text-sm text-neutral-400">
            {language === 'ko' ? '목표를 향한 여정을 시작하세요' : 'Start your journey towards your goals'}
          </Text>
        </Animated.View>

        {/* Plan cards */}
        <Animated.View style={cardsStyle} className="px-4 max-w-lg self-center w-full gap-3">
          {PLANS.map((item, index) => {
            const isSelected = selectedPlan === item.plan;
            const isLoading = loadingPlan === item.plan;
            const showAccentBorder = item.highlight || isSelected;

            return (
              <Animated.View
                key={item.plan}
                entering={FadeIn.delay(500 + index * 100).duration(400)}
              >
                <TouchableOpacity
                  onPress={() => handlePlanTap(item.plan)}
                  activeOpacity={0.85}
                  className={`rounded-2xl border p-4 ${
                    item.highlight
                      ? 'border-[#71B7FF]/50 bg-[#71B7FF]/10'
                      : showAccentBorder
                        ? 'border-[#71B7FF]/30 bg-[#1A1F2E]'
                        : 'border-neutral-700 bg-[#1A1F2E]'
                  }`}
                  style={item.highlight ? {
                    shadowColor: ACCENT, shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.15, shadowRadius: 12, elevation: 4,
                  } : undefined}
                >
                  {/* Plan header */}
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-row items-center gap-2">
                      {item.highlight && <Crown size={15} color={ACCENT} />}
                      <View>
                        <Text className="text-sm font-bold text-white">
                          {item.label}
                        </Text>
                        <Text className="text-[11px] text-neutral-400">
                          {item.price}
                        </Text>
                      </View>
                    </View>
                    {item.badge && (
                      <View className="bg-[#71B7FF]/20 border border-[#71B7FF]/40 rounded-full px-2 py-0.5">
                        <Text className="text-[10px] font-bold text-[#71B7FF]">
                          {item.badge}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Features */}
                  <View className="flex-row flex-wrap gap-x-3 gap-y-1 mb-3">
                    {item.features.map((f) => (
                      <View key={f} className="flex-row items-center gap-1">
                        <Check size={10} color={item.highlight ? ACCENT : MUTED} />
                        <Text className="text-[11px] text-neutral-400">{f}</Text>
                      </View>
                    ))}
                  </View>

                  {/* CTA button */}
                  <TouchableOpacity
                    onPress={() => handleSelect(item.plan)}
                    disabled={loadingPlan !== null}
                    activeOpacity={0.85}
                    className={`w-full py-3 rounded-xl items-center justify-center flex-row gap-2 ${
                      item.highlight ? 'bg-white' : 'bg-neutral-700'
                    } ${loadingPlan !== null ? 'opacity-50' : ''}`}
                    style={item.highlight ? {
                      shadowColor: '#fff', shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.1, shadowRadius: 8,
                    } : undefined}
                  >
                    {isLoading ? (
                      <>
                        <ActivityIndicator size="small" color={item.highlight ? BG : '#fff'} />
                        <Text className={`text-sm font-bold ${item.highlight ? 'text-[#0A0E1A]' : 'text-white'}`}>
                          {t.common.processing}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text className={`text-sm font-bold ${item.highlight ? 'text-[#0A0E1A]' : 'text-white'}`}>
                          {item.cta}
                        </Text>
                        <ArrowRight size={14} color={item.highlight ? BG : '#fff'} />
                      </>
                    )}
                  </TouchableOpacity>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </Animated.View>

        {/* Error message */}
        {error ? (
          <Animated.View entering={FadeIn.duration(300)} className="mt-4 mx-4 p-3 rounded-xl border border-red-500/20 bg-red-500/10 flex-row items-center gap-2">
            <AlertTriangle size={14} color="#EF4444" />
            <Text className="text-xs text-red-300 flex-1">{error}</Text>
          </Animated.View>
        ) : null}

        {/* Footer */}
        <Text className="mt-6 text-[11px] text-neutral-500 text-center leading-relaxed px-6">
          {t.onboarding.footer}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
