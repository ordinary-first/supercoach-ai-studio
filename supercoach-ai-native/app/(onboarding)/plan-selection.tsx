import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, Crown, Sparkles, Star, ArrowRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from '../../shared/i18n/useTranslation';
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

export default function PlanSelectionScreen() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>('explorer');
  const [loadingPlan, setLoadingPlan] = useState<PlanTier | null>(null);
  const [error, setError] = useState('');

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

    try {
      // TODO: call completeOnboarding / polarService when available
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : t.onboarding.error);
      setLoadingPlan(null);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-8"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="items-center pt-12 pb-6 px-6">
          <View className="w-16 h-16 rounded-full mb-4 bg-surface border-2 border-accent items-center justify-center">
            <Star size={28} color={ACCENT} />
          </View>
          <Text className="text-2xl font-bold text-white mb-1">
            {t.onboarding.welcome.replace('{name}', 'User')}
          </Text>
          <Text className="text-sm text-gray-400">
            {t.onboarding.subtitle}
          </Text>
        </View>

        {/* Plan selection label */}
        <View className="flex-row items-center justify-center gap-2 mb-4 px-4">
          <Sparkles size={14} color={ACCENT} />
          <Text className="text-[13px] text-gray-400 font-medium">
            {t.onboarding.selectPlan}
          </Text>
        </View>

        {/* Plan cards */}
        <View className="px-4 max-w-lg self-center w-full gap-3">
          {PLANS.map((item) => {
            const isSelected = selectedPlan === item.plan;
            const isLoading = loadingPlan === item.plan;
            const showAccentBorder = item.highlight || isSelected;

            return (
              <Pressable
                key={item.plan}
                onPress={() => setSelectedPlan(item.plan)}
                className={`rounded-2xl border p-4 ${
                  item.highlight
                    ? 'border-accent bg-accent/10'
                    : showAccentBorder
                      ? 'border-accent bg-surface'
                      : 'border-gray-700 bg-surface'
                }`}
              >
                {/* Plan header */}
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-row items-center gap-2">
                    {item.highlight && <Crown size={15} color={ACCENT} />}
                    <View>
                      <Text className="text-sm font-bold text-white">
                        {item.label}
                      </Text>
                      <Text className="text-[11px] text-gray-400">
                        {item.price}
                      </Text>
                    </View>
                  </View>
                  {item.badge && (
                    <View className="bg-accent/20 border border-accent rounded-full px-2 py-0.5">
                      <Text className="text-[10px] font-bold text-accent">
                        {item.badge}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Features */}
                <View className="flex-row flex-wrap gap-x-3 gap-y-1 mb-3">
                  {item.features.map((f) => (
                    <View key={f} className="flex-row items-center gap-1">
                      <Check
                        size={10}
                        color={item.highlight ? ACCENT : MUTED}
                      />
                      <Text className="text-[11px] text-gray-400">{f}</Text>
                    </View>
                  ))}
                </View>

                {/* CTA button */}
                <Pressable
                  onPress={() => handleSelect(item.plan)}
                  disabled={loadingPlan !== null}
                  className={`w-full py-2.5 rounded-xl items-center justify-center flex-row gap-2 ${
                    item.highlight ? 'bg-accent' : 'bg-gray-700'
                  } ${loadingPlan !== null ? 'opacity-50' : ''}`}
                >
                  {isLoading ? (
                    <>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text className="text-sm font-bold text-white">
                        {t.common.processing}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text
                        className={`text-sm font-bold ${
                          item.highlight ? 'text-background' : 'text-white'
                        }`}
                      >
                        {item.cta}
                      </Text>
                      <ArrowRight
                        size={14}
                        color={item.highlight ? BG : '#fff'}
                      />
                    </>
                  )}
                </Pressable>
              </Pressable>
            );
          })}
        </View>

        {/* Error message */}
        {error ? (
          <Text className="mt-3 text-xs text-red-400 text-center px-4">
            {error}
          </Text>
        ) : null}

        {/* Footer */}
        <Text className="mt-6 text-[11px] text-gray-500 text-center leading-relaxed px-6">
          {t.onboarding.footer}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
