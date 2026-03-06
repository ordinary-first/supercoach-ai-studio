import React, { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  Camera,
  ChevronRight,
  Crown,
  Globe,
  Image as ImageIcon,
  Loader2,
  LogOut,
  MapPin,
  Monitor,
  Plus,
  Quote,
  Save,
  Settings,
  ShieldCheck,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useThemeStore } from '../stores/useThemeStore';
import {
  createPolarCheckout,
  changePlan,
  cancelSubscription,
  type PlanTier,
} from '../services/polarService';
import type { UserProfile } from '../types';
import { uploadProfileGalleryImage } from '../services/aiService';
import { getUserId, loadUsage, type MonthlyUsage } from '../services/firebaseService';
import { useTranslation } from '../i18n/useTranslation';

const compressImage = (
  file: File,
  maxWidth: number = 400,
  quality: number = 0.75,
): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height, 1);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve('');
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(event.target?.result || '');
    };
    reader.readAsDataURL(file);
  });
};

type LanguageOption = 'en' | 'ko';

interface SettingsPageProps {
  isOpen: boolean;
  onClose: () => void;
  language: LanguageOption;
  onLanguageChange: (language: LanguageOption) => void;
  userAge?: string;
  userEmail?: string;
  userName?: string;
  externalCustomerId?: string;
  profile: UserProfile | null;
  onSaveProfile: (updated: UserProfile) => void;
  onLogout: () => void;
}

// Labels are now in t.settings.* via useTranslation

const PLANS: { plan: PlanTier; title: string; price: string }[] = [
  { plan: 'explorer', title: 'Explorer', price: 'Free' },
  { plan: 'essential', title: 'Essential', price: '$9.99/mo' },
  { plan: 'visionary', title: 'Visionary', price: '$19.99/mo' },
  { plan: 'master', title: 'Master', price: '$49.99/mo' },
];

const PLAN_LIMITS: Record<string, Record<string, number>> = {
  explorer: {
    chatMessages: 300, narrativeCalls: 5, imageCredits: 8,
    audioMinutes: 0, videoGenerations: 0,
  },
  essential: {
    chatMessages: 2500, narrativeCalls: 20, imageCredits: 80,
    audioMinutes: 30, videoGenerations: 0,
  },
  visionary: {
    chatMessages: 6000, narrativeCalls: 40, imageCredits: 180,
    audioMinutes: 90, videoGenerations: 4,
  },
  master: {
    chatMessages: 15000, narrativeCalls: 80, imageCredits: 450,
    audioMinutes: 240, videoGenerations: 12,
  },
};

// Resource labels are now in t.settings.resourceLabels via useTranslation

const SettingsPage: React.FC<SettingsPageProps> = ({
  isOpen,
  onClose,
  language,
  onLanguageChange,
  userAge,
  userEmail,
  userName,
  externalCustomerId,
  profile,
  onSaveProfile,
  onLogout,
}) => {
  const { preference: themePref, setTheme } = useThemeStore();
  const { t } = useTranslation();
  const [loadingPlan, setLoadingPlan] = useState<PlanTier | null>(null);
  const [checkoutError, setCheckoutError] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [formData, setFormData] = useState<UserProfile>(
    profile ? { ...profile, bio: profile.bio || '', gallery: profile.gallery || [] } : { name: '', email: '', age: '', gender: 'Male', location: '', bio: '', gallery: [] }
  );
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [usage, setUsage] = useState<MonthlyUsage | null>(null);

  useEffect(() => {
    if (!isOpen || !externalCustomerId) return;
    loadUsage(externalCustomerId).then(setUsage);
  }, [isOpen, externalCustomerId]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const uid = getUserId();
    if (!uid) return;
    setIsUploadingMedia(true);
    const compressed = await compressImage(file, 320, 0.8);
    const uploadedUrl = compressed
      ? await uploadProfileGalleryImage(compressed, uid, 'avatar')
      : undefined;
    setIsUploadingMedia(false);
    if (uploadedUrl) {
      setFormData((prev) => ({ ...prev, avatarUrl: uploadedUrl }));
    }
    e.target.value = '';
  };

  const handleAddToGallery = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const uid = getUserId();
    if (!uid) return;
    setIsUploadingMedia(true);
    const nextUrls: string[] = [];
    for (const file of Array.from<File>(files)) {
      const compressed = await compressImage(file, 960, 0.82);
      if (!compressed) continue;
      const uploaded = await uploadProfileGalleryImage(compressed, uid, 'gallery');
      if (uploaded) nextUrls.push(uploaded);
      if ((formData.gallery?.length || 0) + nextUrls.length >= 6) break;
    }
    setIsUploadingMedia(false);
    if (nextUrls.length > 0) {
      setFormData((prev) => {
        const updated = { ...prev, gallery: [...(prev.gallery || []), ...nextUrls].slice(0, 6) };
        onSaveProfile(updated);
        return updated;
      });
    }
    e.target.value = '';
  };

  const removeFromGallery = (index: number) => {
    setFormData((prev) => {
      const updated = { ...prev, gallery: prev.gallery?.filter((_, i) => i !== index) };
      onSaveProfile(updated);
      return updated;
    });
  };

  const hasAvatar = !!(formData.avatarUrl && formData.avatarUrl.length > 0);

  if (!isOpen) return null;

  const labels = t.settings;

  const customerId = (() => {
    if (externalCustomerId && externalCustomerId.trim().length > 0) {
      return externalCustomerId.trim();
    }
    if (userEmail && userEmail.trim().length > 0) {
      return `email:${userEmail.trim().toLowerCase()}`;
    }
    return undefined;
  })();

  const isSubscriber = !!(
    profile?.billingIsActive && profile?.billingSubscriptionId
  );

  const PLAN_ORDER: Record<string, number> = {
    explorer: 0, essential: 1, visionary: 2, master: 3,
  };

  const handleCheckout = async (plan: PlanTier) => {
    setCheckoutError('');
    setLoadingPlan(plan);

    try {
      const { url } = await createPolarCheckout({
        plan,
        customerEmail: userEmail,
        customerName: userName,
        externalCustomerId: customerId,
      });
      window.location.assign(url);
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : labels.checkoutFailed;
      setCheckoutError(message);
      setLoadingPlan(null);
    }
  };

  const handleChangePlan = async (newPlan: PlanTier) => {
    if (!profile?.billingSubscriptionId) return;
    setCheckoutError('');
    setLoadingPlan(newPlan);

    try {
      await changePlan(profile.billingSubscriptionId, newPlan);
      // 페이지 새로고침으로 동기화 반영
      window.location.reload();
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : labels.checkoutFailed;
      setCheckoutError(message);
      setLoadingPlan(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!profile?.billingSubscriptionId) return;
    setCheckoutError('');
    setShowCancelConfirm(false);
    setLoadingPlan('explorer');

    try {
      await cancelSubscription(profile.billingSubscriptionId);
      window.location.reload();
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : labels.checkoutFailed;
      setCheckoutError(message);
      setLoadingPlan(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-th-base text-th-text">
      <div className="h-14 md:h-16 border-b border-th-border bg-th-header backdrop-blur-md px-4 md:px-6 flex items-center justify-between">
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-th-surface hover:bg-th-surface-hover transition-all flex items-center justify-center text-th-text-secondary"
          aria-label="Close settings"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2">
          <Settings size={16} className="text-th-accent" />
          <h1 className="text-sm md:text-base font-semibold tracking-wide">
            {labels.title}
          </h1>
        </div>

        <div className="w-9" />
      </div>

      <div className="h-[calc(100%-56px)] md:h-[calc(100%-64px)] overflow-y-auto px-4 py-6">
        <div className="max-w-xl mx-auto space-y-4">
          {/* 프로필 섹션 */}
          {profile && (
            <section className="rounded-2xl border border-th-border bg-th-surface p-4 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-th-text-secondary">
                  <User size={14} className="text-th-accent" />
                  <span>{labels.profile}</span>
                </div>
                <button
                  onClick={() => onSaveProfile(formData)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-th-accent text-th-text-inverse font-bold rounded-full hover:bg-white transition-all text-[11px]"
                >
                  <Save size={12} /> {t.common.save}
                </button>
              </div>

              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="w-16 h-16 rounded-full bg-th-surface border border-th-border overflow-hidden">
                    {hasAvatar ? (
                      <img src={formData.avatarUrl} className="w-full h-full object-cover" alt="avatar" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User size={28} className="text-th-text-tertiary" />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 p-1.5 bg-th-accent text-th-text-inverse rounded-full shadow-lg hover:scale-110 transition-all"
                    disabled={isUploadingMedia}
                  >
                    <Camera size={12} />
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleAvatarChange}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-transparent text-lg font-bold text-th-text w-full focus:outline-none border-b border-transparent focus:border-th-accent-border pb-1 transition-colors"
                    placeholder={labels.name}
                  />
                  <p className="text-[10px] text-th-text-tertiary mt-1">{formData.email}</p>
                </div>
              </div>

              <div className="bg-th-header rounded-xl border border-th-border-subtle divide-y divide-th-border-subtle overflow-hidden">
                <div className="flex items-center gap-3 p-3">
                  <Calendar size={16} className="text-th-text-tertiary shrink-0" />
                  <div className="flex-1">
                    <p className="text-[10px] text-th-text-tertiary font-bold">{labels.age}</p>
                    <input
                      type="number"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      className="bg-transparent text-th-text text-sm w-full focus:outline-none mt-0.5"
                      placeholder={labels.age}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3">
                  <User size={16} className="text-th-text-tertiary shrink-0" />
                  <div className="flex-1">
                    <p className="text-[10px] text-th-text-tertiary font-bold">{labels.gender}</p>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                      className="bg-transparent text-th-text text-sm w-full focus:outline-none mt-0.5 appearance-none"
                    >
                      <option value="Male" className="bg-th-card">{labels.genderOptions.Male}</option>
                      <option value="Female" className="bg-th-card">{labels.genderOptions.Female}</option>
                      <option value="Other" className="bg-th-card">{labels.genderOptions.Other}</option>
                    </select>
                  </div>
                  <ChevronRight size={14} className="text-th-text-muted" />
                </div>
                <div className="flex items-center gap-3 p-3">
                  <MapPin size={16} className="text-th-text-tertiary shrink-0" />
                  <div className="flex-1">
                    <p className="text-[10px] text-th-text-tertiary font-bold">{labels.location}</p>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="bg-transparent text-th-text text-sm w-full focus:outline-none mt-0.5"
                      placeholder={labels.location}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-th-text-secondary text-[11px] font-bold">
                  <Quote size={12} className="text-th-accent" />
                  {labels.bio}
                </div>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder={labels.bio}
                  className="w-full h-24 bg-th-header border border-th-border-subtle rounded-xl p-3 text-sm text-th-text leading-relaxed focus:outline-none focus:border-th-accent-border transition-all resize-none"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-th-text-secondary text-[11px] font-bold">
                    <ImageIcon size={12} className="text-th-accent" />
                    {labels.gallery}
                  </div>
                  <span className="text-[10px] text-th-text-muted">{formData.gallery?.length || 0} / 6</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {formData.gallery?.map((img, idx) => (
                    <div key={idx} className="relative aspect-square group rounded-xl overflow-hidden border border-th-border">
                      <img src={img} className="w-full h-full object-cover" alt={`gallery-${idx}`} />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={() => removeFromGallery(idx)}
                          className="p-2 bg-red-500 text-white rounded-full hover:scale-110 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {(formData.gallery?.length || 0) < 6 && (
                    <button
                      onClick={() => galleryInputRef.current?.click()}
                      disabled={isUploadingMedia}
                      className="aspect-square border border-dashed border-th-border rounded-xl flex flex-col items-center justify-center gap-1 text-th-text-tertiary hover:border-th-accent hover:text-th-accent transition-all disabled:opacity-60"
                    >
                      <Plus size={18} />
                      <span className="text-[9px] font-bold">
                        {isUploadingMedia ? t.common.processing : t.common.add}
                      </span>
                    </button>
                  )}
                  <input
                    type="file"
                    ref={galleryInputRef}
                    className="hidden"
                    multiple
                    accept="image/*"
                    onChange={handleAddToGallery}
                  />
                </div>
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-th-border bg-th-surface p-4">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-th-text-secondary mb-3">
              <Globe size={14} className="text-th-accent" />
              <span>{labels.language}</span>
            </div>
            <select
              value={language}
              onChange={(event) =>
                onLanguageChange(event.target.value as LanguageOption)
              }
              className="w-full bg-th-elevated border border-th-border rounded-xl px-3 py-2.5 text-sm text-th-text outline-none focus:border-th-accent"
            >
              <option value="en">English</option>
              <option value="ko">한국어</option>
            </select>
          </section>

          <section className="rounded-2xl border border-th-border bg-th-surface p-4">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-th-text-secondary mb-3">
              <Monitor size={14} className="text-th-accent" />
              <span>Theme</span>
            </div>
            <div className="flex gap-2">
              {(['system', 'light', 'dark'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setTheme(opt)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all border ${
                    themePref === opt
                      ? 'bg-th-accent text-th-text-inverse border-th-accent'
                      : 'bg-th-surface border-th-border text-th-text-secondary hover:bg-th-surface-hover'
                  }`}
                >
                  {opt === 'system' ? 'System' : opt === 'light' ? 'Light' : 'Dark'}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-th-border bg-th-surface overflow-hidden">
            <div className="w-full flex items-center justify-between px-4 py-3.5 border-b border-th-border">
              <div className="flex items-center gap-2">
                <Crown size={16} className="text-th-accent" />
                <span className="text-sm">{labels.subscription}</span>
              </div>
              <span className="text-[11px] text-th-text-secondary">{labels.choosePlan}</span>
            </div>

            {usage && (() => {
              const planKey = profile?.billingPlan || 'explorer';
              const limits = PLAN_LIMITS[planKey] || PLAN_LIMITS.explorer;
              const resources = Object.entries(limits).filter(
                ([, lim]) => lim > 0,
              );
              if (resources.length === 0) return null;
              return (
                <div className="px-4 py-3 border-b border-th-border space-y-2">
                  <p className="text-[11px] text-th-text-secondary font-bold uppercase tracking-wider">
                    {labels.monthlyUsage}
                  </p>
                  {resources.map(([key, lim]) => {
                    const cur = (usage as Record<string, number>)[key] ?? 0;
                    const pct = Math.min((cur / lim) * 100, 100);
                    const color =
                      pct >= 100
                        ? 'bg-red-500'
                        : pct >= 80
                          ? 'bg-amber-400'
                          : 'bg-th-accent';
                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-th-text-secondary">
                            {(labels.resourceLabels as Record<string, string>)[key] || key}
                          </span>
                          <span
                            className={
                              pct >= 100
                                ? 'text-red-400'
                                : pct >= 80
                                  ? 'text-amber-300'
                                  : 'text-th-text'
                            }
                          >
                            {cur} / {lim}
                          </span>
                        </div>
                        <div className="h-1.5 bg-th-surface rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${color} transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            <div className="px-4 py-3.5 border-b border-th-border space-y-2">
              {PLANS.map((item) => {
                const currentPlan = profile?.billingPlan || 'explorer';
                const isCurrent = item.plan === currentPlan;
                const isLoading = loadingPlan === item.plan;
                const currentOrder = PLAN_ORDER[currentPlan] ?? 0;
                const itemOrder = PLAN_ORDER[item.plan] ?? 0;
                const isUpgrade = itemOrder > currentOrder;
                const isDowngrade = itemOrder < currentOrder;

                const renderAction = () => {
                  if (isCurrent) {
                    return (
                      <span className="text-[10px] text-th-accent font-bold border border-th-accent-border rounded-full px-2 py-0.5">
                        {labels.currentPlan}
                      </span>
                    );
                  }

                  if (isLoading) {
                    return (
                      <span className="inline-flex items-center gap-1 text-xs text-th-text-secondary">
                        <Loader2 size={13} className="animate-spin" />
                        {t.common.processing}
                      </span>
                    );
                  }

                  // 구독자: 업/다운그레이드 버튼
                  if (isSubscriber && item.plan !== 'explorer') {
                    return (
                      <button
                        onClick={() => handleChangePlan(item.plan)}
                        disabled={loadingPlan !== null}
                        className={`inline-flex items-center gap-1 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          isUpgrade
                            ? 'text-th-accent hover:text-th-text'
                            : 'text-amber-400 hover:text-amber-200'
                        }`}
                      >
                        {isUpgrade ? labels.upgrade : labels.downgrade}
                      </button>
                    );
                  }

                  // 비구독자: 결제 시작
                  if (item.plan !== 'explorer') {
                    return (
                      <button
                        onClick={() => handleCheckout(item.plan)}
                        disabled={loadingPlan !== null}
                        className="inline-flex items-center gap-1 text-xs text-th-accent hover:text-th-text transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {labels.checkout}
                      </button>
                    );
                  }

                  return null;
                };

                return (
                  <div
                    key={item.plan}
                    className={`rounded-xl border bg-th-header px-3 py-2.5 ${isCurrent ? 'border-th-accent-border' : 'border-th-border'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-th-text font-medium">{item.title}</p>
                        <p className="text-[11px] text-th-text-secondary">{item.price}</p>
                      </div>
                      {renderAction()}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5">
                      {(labels.planFeatures[item.plan as keyof typeof labels.planFeatures] || []).map((f) => (
                        <span key={f} className="text-[10px] text-th-text-tertiary">{f}</span>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* 구독 취소 */}
              {isSubscriber && !showCancelConfirm && (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="w-full text-[11px] text-th-text-tertiary hover:text-red-400 transition-colors pt-2"
                >
                  {labels.cancelSubscription}
                </button>
              )}
              {isSubscriber && showCancelConfirm && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 space-y-2">
                  <p className="text-xs text-th-text">
                    {labels.cancelSubscriptionConfirm}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowCancelConfirm(false)}
                      className="flex-1 py-2 bg-th-surface hover:bg-th-surface-hover rounded-lg text-xs font-medium transition-all"
                    >
                      {t.common.cancel}
                    </button>
                    <button
                      onClick={handleCancelSubscription}
                      disabled={loadingPlan !== null}
                      className="flex-1 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                    >
                      {t.common.confirm}
                    </button>
                  </div>
                </div>
              )}

              {checkoutError && (
                <p className="text-xs text-red-300 pt-1">{checkoutError}</p>
              )}
            </div>

            <div className="px-4 py-3.5">
              <div className="flex items-center gap-2 text-xs text-th-text mb-2">
                <ShieldCheck size={14} className="text-th-accent" />
                <span>{labels.polarPolicyTitle}</span>
              </div>
              <ul className="space-y-1.5 text-[12px] text-th-text-secondary">
                <li>{labels.ruleDigitalOnly}</li>
                <li>{labels.ruleNoHumanService}</li>
                <li>{labels.ruleNoDonation}</li>
                <li>{labels.ruleInstantAccess}</li>
              </ul>
            </div>

            <div className="px-4 py-3.5 border-t border-th-border">
              <div className="flex items-center gap-2 text-xs text-th-text mb-2">
                <ShieldCheck size={14} className="text-th-accent" />
                <span>{labels.legalTitle}</span>
              </div>
              <p className="text-[11px] text-th-text-secondary leading-relaxed">
                {labels.legalHint}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                <a
                  href="/terms"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-th-border bg-th-header px-3 py-1 text-th-accent hover:border-th-accent-border"
                >
                  {labels.terms}
                </a>
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-th-border bg-th-header px-3 py-1 text-th-accent hover:border-th-accent-border"
                >
                  {labels.privacy}
                </a>
                <a
                  href="/refund"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-th-border bg-th-header px-3 py-1 text-th-accent hover:border-th-accent-border"
                >
                  {labels.refund}
                </a>
              </div>
            </div>
          </section>

          {/* 로그아웃 */}
          <section className="rounded-2xl border border-th-border bg-th-surface overflow-hidden">
            {showLogoutConfirm ? (
              <div className="p-4 space-y-3">
                <p className="text-sm text-th-text">{labels.logoutConfirm}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowLogoutConfirm(false)}
                    className="flex-1 py-2.5 bg-th-surface hover:bg-th-surface-hover rounded-xl text-sm font-medium transition-all"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    onClick={onLogout}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-medium transition-all"
                  >
                    {labels.logoutTitle}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 text-th-text-tertiary hover:text-red-400 hover:bg-red-500/5 transition-all"
              >
                <LogOut size={16} />
                <span className="text-sm">{labels.logoutTitle}</span>
              </button>
            )}
          </section>

          <p className="text-xs text-th-text-secondary text-center mt-6 pb-4">
            {__APP_VERSION__}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
