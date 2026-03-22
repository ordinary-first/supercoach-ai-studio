import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import {
  User,
  Globe,
  Moon,
  Sun,
  Monitor,
  Bell,
  CreditCard,
  LogOut,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Camera,
  MapPin,
  Calendar,
  Quote,
  Image as ImageIcon,
  Plus,
  Crown,
  ShieldCheck,
  Settings,
  Save,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useThemeStore } from '../stores/useThemeStore';
import { useTranslation } from '../shared/i18n/useTranslation';
import { usePurchases } from '../hooks/usePurchases';
import { logOutPurchases } from '../services/purchaseService';
import { logout } from '../services/firebaseService';
import type { UserProfile } from '../shared/types';

const LEGAL_LINKS = ['terms', 'privacy', 'refund'] as const;

// ---------------------------------------------------------------------------
// Reusable sub-components
// ---------------------------------------------------------------------------

function Section({ children }: { children: React.ReactNode }) {
  return (
    <View className="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-hidden mb-4">
      {children}
    </View>
  );
}

function SectionHeader({
  icon,
  label,
  right,
}: {
  icon: React.ReactNode;
  label: string;
  right?: React.ReactNode;
}) {
  return (
    <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
      <View className="flex-row items-center gap-2">
        {icon}
        <Text className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 font-semibold">
          {label}
        </Text>
      </View>
      {right}
    </View>
  );
}

function SettingRow({
  icon,
  label,
  sublabel,
  right,
  onPress,
  border = true,
}: {
  icon?: React.ReactNode;
  label: string;
  sublabel?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  border?: boolean;
}) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      onPress={onPress}
      className={`flex-row items-center px-4 py-3 gap-3 ${border ? 'border-b border-neutral-100 dark:border-neutral-700' : ''}`}
    >
      {icon && <View className="w-5 items-center">{icon}</View>}
      <View className="flex-1">
        <Text className="text-sm text-neutral-900 dark:text-neutral-100">{label}</Text>
        {sublabel ? (
          <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{sublabel}</Text>
        ) : null}
      </View>
      {right}
    </Wrapper>
  );
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ICON_COLOR = '#6366f1';
const ICON_SIZE = 16;
const MUTED_COLOR = '#a3a3a3';

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SettingsScreen() {
  const router = useRouter();
  const { preference: themePref, setTheme } = useThemeStore();
  const { language, t, setLanguage } = useTranslation();
  const labels = t.settings;

  // --- Stub profile (replace with real auth / Firestore hooks) -------------
  const [formData, setFormData] = useState<UserProfile>({
    name: '',
    email: '',
    age: '',
    gender: 'Male',
    location: '',
    bio: '',
    gallery: [],
  });

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const { plan: rcPlan, offerings, purchase, restore, loading: rcLoading } = usePurchases();
  const hasAvatar = !!(formData.avatarUrl && formData.avatarUrl.length > 0);

  // --- Handlers ------------------------------------------------------------

  const handleGoBack = useCallback(() => {
    if (router.canGoBack()) router.back();
  }, [router]);

  const handleSaveProfile = useCallback(() => {
    // TODO: wire to actual profile save
    Alert.alert(labels.profileSave, labels.name);
  }, [labels]);

  const handlePickAvatar = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setIsUploadingAvatar(true);
      // TODO: upload to server and get URL
      setFormData((prev) => ({ ...prev, avatarUrl: result.assets[0].uri }));
      setIsUploadingAvatar(false);
    }
  }, []);

  const handlePickGalleryImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      const newUris = result.assets.map((a) => a.uri);
      setFormData((prev) => ({
        ...prev,
        gallery: [...(prev.gallery ?? []), ...newUris].slice(0, 6),
      }));
    }
  }, []);

  const removeFromGallery = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      gallery: prev.gallery?.filter((_, i) => i !== index),
    }));
  }, []);

  const handleLogout = useCallback(() => {
    Alert.alert(labels.logoutTitle, labels.logoutConfirm, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: labels.logoutTitle,
        style: 'destructive',
        onPress: async () => {
          try { await logOutPurchases(); } catch {}
          await logout();
        },
      },
    ]);
  }, [labels, t.common.cancel]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      t.common.delete,
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: () => {
            // TODO: call account deletion endpoint
          },
        },
      ],
    );
  }, [t.common]);

  const openLink = useCallback((path: string) => {
    Linking.openURL(`https://supercoach.ai/${path}`);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'en' ? 'ko' : 'en');
  }, [language, setLanguage]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900" edges={['top']}>
      {/* Header */}
      <View className="h-14 flex-row items-center justify-between px-4 border-b border-neutral-200 dark:border-neutral-700 bg-white/80 dark:bg-neutral-800/80">
        <TouchableOpacity
          onPress={handleGoBack}
          className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-neutral-700 items-center justify-center"
        >
          <ChevronLeft size={18} color={MUTED_COLOR} />
        </TouchableOpacity>

        <View className="flex-row items-center gap-2">
          <Settings size={16} color={ICON_COLOR} />
          <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {labels.title}
          </Text>
        </View>

        <View className="w-9" />
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ====== PROFILE SECTION ====== */}
        <Section>
          <SectionHeader
            icon={<User size={14} color={ICON_COLOR} />}
            label={labels.profile}
            right={
              <TouchableOpacity
                onPress={handleSaveProfile}
                className="flex-row items-center gap-1.5 px-3 py-1.5 bg-indigo-500 rounded-full"
              >
                <Save size={12} color="#fff" />
                <Text className="text-xs font-bold text-white">{t.common.save}</Text>
              </TouchableOpacity>
            }
          />

          {/* Avatar + Name */}
          <View className="flex-row items-center gap-4 px-4 pb-3">
            <View className="relative">
              <View className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 overflow-hidden items-center justify-center">
                {hasAvatar ? (
                  <Image
                    source={{ uri: formData.avatarUrl }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                ) : (
                  <User size={28} color={MUTED_COLOR} />
                )}
              </View>
              <TouchableOpacity
                onPress={handlePickAvatar}
                disabled={isUploadingAvatar}
                className="absolute -bottom-1 -right-1 p-1.5 bg-indigo-500 rounded-full"
              >
                {isUploadingAvatar ? (
                  <ActivityIndicator size={12} color="#fff" />
                ) : (
                  <Camera size={12} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
            <View className="flex-1">
              <TextInput
                value={formData.name}
                onChangeText={(text) => setFormData((p) => ({ ...p, name: text }))}
                placeholder={labels.name}
                placeholderTextColor={MUTED_COLOR}
                className="text-lg font-bold text-neutral-900 dark:text-neutral-100 border-b border-transparent pb-1"
              />
              <Text className="text-[10px] text-neutral-400 mt-1">{formData.email}</Text>
            </View>
          </View>

          {/* Detail fields */}
          <View className="mx-4 mb-4 rounded-xl border border-neutral-100 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-850 overflow-hidden">
            {/* Age */}
            <View className="flex-row items-center gap-3 p-3 border-b border-neutral-100 dark:border-neutral-700">
              <Calendar size={ICON_SIZE} color={MUTED_COLOR} />
              <View className="flex-1">
                <Text className="text-[10px] text-neutral-500 dark:text-neutral-400 font-bold">
                  {labels.age}
                </Text>
                <TextInput
                  value={formData.age}
                  onChangeText={(text) => setFormData((p) => ({ ...p, age: text }))}
                  keyboardType="numeric"
                  placeholder={labels.age}
                  placeholderTextColor={MUTED_COLOR}
                  className="text-sm text-neutral-900 dark:text-neutral-100 mt-0.5 p-0"
                />
              </View>
            </View>

            {/* Gender */}
            <TouchableOpacity
              className="flex-row items-center gap-3 p-3 border-b border-neutral-100 dark:border-neutral-700"
              onPress={() => {
                const options: Array<UserProfile['gender']> = ['Male', 'Female', 'Other'];
                const nextIdx = (options.indexOf(formData.gender) + 1) % options.length;
                setFormData((p) => ({ ...p, gender: options[nextIdx] }));
              }}
            >
              <User size={ICON_SIZE} color={MUTED_COLOR} />
              <View className="flex-1">
                <Text className="text-[10px] text-neutral-500 dark:text-neutral-400 font-bold">
                  {labels.gender}
                </Text>
                <Text className="text-sm text-neutral-900 dark:text-neutral-100 mt-0.5">
                  {labels.genderOptions[formData.gender] ?? formData.gender}
                </Text>
              </View>
              <ChevronRight size={14} color={MUTED_COLOR} />
            </TouchableOpacity>

            {/* Location */}
            <View className="flex-row items-center gap-3 p-3">
              <MapPin size={ICON_SIZE} color={MUTED_COLOR} />
              <View className="flex-1">
                <Text className="text-[10px] text-neutral-500 dark:text-neutral-400 font-bold">
                  {labels.location}
                </Text>
                <TextInput
                  value={formData.location}
                  onChangeText={(text) => setFormData((p) => ({ ...p, location: text }))}
                  placeholder={labels.location}
                  placeholderTextColor={MUTED_COLOR}
                  className="text-sm text-neutral-900 dark:text-neutral-100 mt-0.5 p-0"
                />
              </View>
            </View>
          </View>

          {/* Bio */}
          <View className="px-4 pb-2">
            <View className="flex-row items-center gap-2 mb-2">
              <Quote size={12} color={ICON_COLOR} />
              <Text className="text-xs text-neutral-500 dark:text-neutral-400 font-bold">
                {labels.bio}
              </Text>
            </View>
            <TextInput
              value={formData.bio}
              onChangeText={(text) => setFormData((p) => ({ ...p, bio: text }))}
              placeholder={labels.bio}
              placeholderTextColor={MUTED_COLOR}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              className="h-24 bg-neutral-50 dark:bg-neutral-850 border border-neutral-100 dark:border-neutral-700 rounded-xl p-3 text-sm text-neutral-900 dark:text-neutral-100 leading-relaxed"
            />
          </View>

          {/* Gallery */}
          <View className="px-4 pb-4">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center gap-2">
                <ImageIcon size={12} color={ICON_COLOR} />
                <Text className="text-xs text-neutral-500 dark:text-neutral-400 font-bold">
                  {labels.gallery}
                </Text>
              </View>
              <Text className="text-[10px] text-neutral-400">
                {formData.gallery?.length ?? 0} / 6
              </Text>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {formData.gallery?.map((uri, idx) => (
                <View
                  key={idx}
                  className="w-[30%] aspect-square rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-600"
                >
                  <Image source={{ uri }} className="w-full h-full" resizeMode="cover" />
                  <TouchableOpacity
                    onPress={() => removeFromGallery(idx)}
                    className="absolute top-1 right-1 p-1.5 bg-red-500 rounded-full"
                  >
                    <Trash2 size={10} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              {(formData.gallery?.length ?? 0) < 6 && (
                <TouchableOpacity
                  onPress={handlePickGalleryImage}
                  className="w-[30%] aspect-square border border-dashed border-neutral-300 dark:border-neutral-600 rounded-xl items-center justify-center gap-1"
                >
                  <Plus size={18} color={MUTED_COLOR} />
                  <Text className="text-[9px] font-bold text-neutral-400">{t.common.add}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Section>

        {/* ====== LANGUAGE SECTION ====== */}
        <Section>
          <SettingRow
            icon={<Globe size={ICON_SIZE} color={ICON_COLOR} />}
            label={labels.language}
            sublabel={language === 'en' ? 'English' : '\uD55C\uAD6D\uC5B4'}
            border={false}
            right={
              <Switch
                value={language === 'ko'}
                onValueChange={toggleLanguage}
                trackColor={{ false: '#d4d4d4', true: '#6366f1' }}
                thumbColor="#fff"
              />
            }
          />
        </Section>

        {/* ====== THEME SECTION ====== */}
        <Section>
          <SectionHeader icon={<Monitor size={14} color={ICON_COLOR} />} label="Theme" />
          <View className="flex-row gap-2 px-4 pb-4">
            {(['system', 'light', 'dark'] as const).map((opt) => {
              const isActive = themePref === opt;
              const IconComp = opt === 'system' ? Monitor : opt === 'light' ? Sun : Moon;
              return (
                <TouchableOpacity
                  key={opt}
                  onPress={() => setTheme(opt)}
                  className={`flex-1 py-2.5 rounded-xl items-center border ${
                    isActive
                      ? 'bg-indigo-500 border-indigo-500'
                      : 'bg-neutral-50 dark:bg-neutral-700 border-neutral-200 dark:border-neutral-600'
                  }`}
                >
                  <IconComp
                    size={14}
                    color={isActive ? '#fff' : MUTED_COLOR}
                    style={{ marginBottom: 2 }}
                  />
                  <Text
                    className={`text-xs font-medium ${
                      isActive ? 'text-white' : 'text-neutral-500 dark:text-neutral-400'
                    }`}
                  >
                    {opt === 'system' ? 'System' : opt === 'light' ? 'Light' : 'Dark'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Section>

        {/* ====== NOTIFICATION SECTION ====== */}
        <Section>
          <SettingRow
            icon={<Bell size={ICON_SIZE} color={ICON_COLOR} />}
            label={labels.notifications}
            sublabel={notificationsEnabled ? 'Enabled' : 'Disabled'}
            border={false}
            right={
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: '#d4d4d4', true: '#6366f1' }}
                thumbColor="#fff"
              />
            }
          />
        </Section>

        {/* ====== SUBSCRIPTION SECTION ====== */}
        <Section>
          <SectionHeader
            icon={<Crown size={14} color={ICON_COLOR} />}
            label={labels.subscription}
            right={
              <TouchableOpacity onPress={restore}>
                <Text className="text-xs text-indigo-500">Restore</Text>
              </TouchableOpacity>
            }
          />

          <View className="px-4 pb-4 gap-2">
            {offerings?.current?.availablePackages.map((pkg) => {
              const product = pkg.product;
              const isCurrent = rcPlan === pkg.identifier;
              return (
                <TouchableOpacity
                  key={pkg.identifier}
                  disabled={isCurrent || rcLoading}
                  onPress={() => purchase(pkg)}
                  className={`rounded-xl border px-3 py-2.5 ${
                    isCurrent
                      ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                      : 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-850'
                  }`}
                >
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {product.title}
                      </Text>
                      <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                        {product.priceString}
                      </Text>
                    </View>
                    {isCurrent && (
                      <View className="border border-indigo-400 rounded-full px-2 py-0.5">
                        <Text className="text-[10px] text-indigo-500 dark:text-indigo-400 font-bold">
                          {labels.currentPlan}
                        </Text>
                      </View>
                    )}
                  </View>
                  {product.description ? (
                    <Text className="text-[10px] text-neutral-400 mt-1">
                      {product.description}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}

            {!offerings?.current && !rcLoading && (
              <Text className="text-xs text-neutral-500 text-center py-4">
                {labels.currentPlan}: {rcPlan}
              </Text>
            )}
          </View>

          {/* Legal links */}
          <View className="px-4 pb-4 border-t border-neutral-100 dark:border-neutral-700 pt-3">
            <View className="flex-row items-center gap-2 mb-2">
              <ShieldCheck size={14} color={ICON_COLOR} />
              <Text className="text-xs text-neutral-900 dark:text-neutral-100">
                {labels.legalTitle}
              </Text>
            </View>
            <Text className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed mb-2">
              {labels.legalHint}
            </Text>
            <View className="flex-row gap-2 flex-wrap">
              {LEGAL_LINKS.map((key) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => openLink(key)}
                  className="rounded-full border border-neutral-200 dark:border-neutral-600 px-3 py-1"
                >
                  <Text className="text-[11px] text-indigo-500">
                    {labels[key as keyof typeof labels] as string}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Section>

        {/* ====== ACCOUNT SECTION ====== */}
        <Section>
          <SectionHeader
            icon={<User size={14} color={ICON_COLOR} />}
            label={labels.account}
          />

          <SettingRow
            icon={<CreditCard size={ICON_SIZE} color={MUTED_COLOR} />}
            label="Export Data"
            onPress={() => Alert.alert('Export', 'Data export is not yet available.')}
            right={<ChevronRight size={14} color={MUTED_COLOR} />}
          />

          <SettingRow
            icon={<Trash2 size={ICON_SIZE} color="#ef4444" />}
            label={`${t.common.delete} Account`}
            onPress={handleDeleteAccount}
            right={<ChevronRight size={14} color={MUTED_COLOR} />}
          />

          <SettingRow
            icon={<LogOut size={ICON_SIZE} color="#ef4444" />}
            label={labels.logoutTitle}
            onPress={handleLogout}
            border={false}
            right={<ChevronRight size={14} color={MUTED_COLOR} />}
          />
        </Section>

        {/* App version */}
        <Text className="text-xs text-neutral-400 text-center mt-2 mb-8">
          v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
