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
  Plus,
  Quote,
  Save,
  Settings,
  ShieldCheck,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { createPolarCheckout, type PlanTier } from '../services/polarService';
import type { UserProfile } from '../types';
import { uploadProfileGalleryImage } from '../services/aiService';
import { getUserId, loadUsage, type MonthlyUsage } from '../services/firebaseService';

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

const LABELS = {
  en: {
    title: 'Settings',
    language: 'Language',
    subscription: 'Subscription',
    choosePlan: 'Choose your plan',
    checkout: 'Start checkout',
    redirecting: 'Redirecting...',
    account: 'Account',
    notifications: 'Notifications',
    polarPolicyTitle: 'Polar compliance',
    ruleDigitalOnly: 'Digital SaaS only. No physical goods.',
    ruleNoHumanService: 'No consulting or human-delivered service.',
    ruleNoDonation: 'No donations, tips, or pure money transfers.',
    ruleInstantAccess: 'Paid users must get immediate in-app access.',
    legalTitle: 'Legal',
    legalHint:
      'By continuing, you agree to the Terms of Service and acknowledge the Privacy Policy and Refund Policy.',
    terms: 'Terms',
    privacy: 'Privacy',
    refund: 'Refunds',
    checkoutFailed: 'Failed to create checkout session.',
  },
  ko: {
    title: '설정',
    language: '언어',
    subscription: '구독',
    choosePlan: '플랜 선택',
    checkout: '결제 시작',
    redirecting: '이동 중...',
    account: '계정',
    notifications: '알림',
    polarPolicyTitle: 'Polar 규정 체크',
    ruleDigitalOnly: '디지털 SaaS만 판매. 물리 상품 금지.',
    ruleNoHumanService: '컨설팅/인적 서비스 결제 금지.',
    ruleNoDonation: '후원/기부/팁 형태 결제 금지.',
    ruleInstantAccess: '결제 즉시 유료 기능 접근 제공.',
    legalTitle: '약관/정책',
    legalHint:
      '결제를 진행하면 서비스 이용약관에 동의하고, 개인정보 처리방침 및 환불규정을 확인한 것으로 간주합니다.',
    terms: '이용약관',
    privacy: '개인정보',
    refund: '환불규정',
    checkoutFailed: '체크아웃 세션 생성에 실패했습니다.',
  },
};

const PLANS: { plan: PlanTier; title: string; price: string; features: string[] }[] = [
  {
    plan: 'explorer',
    title: 'Explorer',
    price: 'Free',
    features: ['코칭 채팅 300회/월', '내러티브 5회/월', '이미지 8장/월'],
  },
  {
    plan: 'essential',
    title: 'Essential',
    price: '$9.99/mo',
    features: ['코칭 채팅 2,500회/월', '내러티브 20회/월', '이미지 80장/월', '음성 TTS 30분/월'],
  },
  {
    plan: 'visionary',
    title: 'Visionary',
    price: '$19.99/mo',
    features: ['코칭 채팅 6,000회/월', '내러티브 40회/월', '이미지 180장 (고품질)/월', '음성 90분/월', '영상 4회/월'],
  },
  {
    plan: 'master',
    title: 'Master',
    price: '$49.99/mo',
    features: ['코칭 채팅 15,000회/월', '내러티브 80회/월', '이미지 450장 (고품질)/월', '음성 240분/월', '영상 12회/월'],
  },
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

const RESOURCE_LABELS: Record<string, string> = {
  chatMessages: '코칭 채팅',
  narrativeCalls: '내러티브',
  imageCredits: '이미지',
  audioMinutes: '음성 (분)',
  videoGenerations: '영상',
};

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
  const [loadingPlan, setLoadingPlan] = useState<PlanTier | null>(null);
  const [checkoutError, setCheckoutError] = useState('');
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
      setFormData((prev) => ({
        ...prev,
        gallery: [...(prev.gallery || []), ...nextUrls].slice(0, 6),
      }));
    }
    e.target.value = '';
  };

  const removeFromGallery = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      gallery: prev.gallery?.filter((_, i) => i !== index),
    }));
  };

  const hasAvatar = !!(formData.avatarUrl && formData.avatarUrl.length > 0);

  if (!isOpen) return null;

  const labels = LABELS[language];

  const customerId = (() => {
    if (externalCustomerId && externalCustomerId.trim().length > 0) {
      return externalCustomerId.trim();
    }
    if (userEmail && userEmail.trim().length > 0) {
      return `email:${userEmail.trim().toLowerCase()}`;
    }
    return undefined;
  })();

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

  return (
    <div className="fixed inset-0 z-[120] bg-deep-space text-white">
      <div className="h-14 md:h-16 border-b border-white/10 bg-black/30 backdrop-blur-md px-4 md:px-6 flex items-center justify-between">
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center text-gray-300"
          aria-label="Close settings"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2">
          <Settings size={16} className="text-neon-lime" />
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
            <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-gray-400">
                  <User size={14} className="text-neon-lime" />
                  <span>프로필</span>
                </div>
                <button
                  onClick={() => onSaveProfile(formData)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neon-lime text-black font-bold rounded-full hover:bg-white transition-all text-[11px]"
                >
                  <Save size={12} /> 저장
                </button>
              </div>

              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 overflow-hidden">
                    {hasAvatar ? (
                      <img src={formData.avatarUrl} className="w-full h-full object-cover" alt="avatar" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User size={28} className="text-gray-500" />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 p-1.5 bg-neon-lime text-black rounded-full shadow-lg hover:scale-110 transition-all"
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
                    className="bg-transparent text-lg font-bold text-white w-full focus:outline-none border-b border-transparent focus:border-neon-lime/30 pb-1 transition-colors"
                    placeholder="이름을 입력하세요"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">{formData.email}</p>
                </div>
              </div>

              <div className="bg-black/20 rounded-xl border border-white/5 divide-y divide-white/5 overflow-hidden">
                <div className="flex items-center gap-3 p-3">
                  <Calendar size={16} className="text-gray-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-[10px] text-gray-500 font-bold">나이</p>
                    <input
                      type="number"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      className="bg-transparent text-white text-sm w-full focus:outline-none mt-0.5"
                      placeholder="나이를 입력하세요"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3">
                  <User size={16} className="text-gray-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-[10px] text-gray-500 font-bold">성별</p>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                      className="bg-transparent text-white text-sm w-full focus:outline-none mt-0.5 appearance-none"
                    >
                      <option value="Male" className="bg-deep-space">남성</option>
                      <option value="Female" className="bg-deep-space">여성</option>
                      <option value="Other" className="bg-deep-space">기타</option>
                    </select>
                  </div>
                  <ChevronRight size={14} className="text-gray-600" />
                </div>
                <div className="flex items-center gap-3 p-3">
                  <MapPin size={16} className="text-gray-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-[10px] text-gray-500 font-bold">위치</p>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="bg-transparent text-white text-sm w-full focus:outline-none mt-0.5"
                      placeholder="도시를 입력하세요"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-400 text-[11px] font-bold">
                  <Quote size={12} className="text-neon-lime" />
                  자기소개
                </div>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="관심사와 목표를 적어주세요."
                  className="w-full h-24 bg-black/20 border border-white/5 rounded-xl p-3 text-sm text-gray-200 leading-relaxed focus:outline-none focus:border-neon-lime/30 transition-all resize-none"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-gray-400 text-[11px] font-bold">
                    <ImageIcon size={12} className="text-neon-lime" />
                    포토 갤러리
                  </div>
                  <span className="text-[10px] text-gray-600">{formData.gallery?.length || 0} / 6</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {formData.gallery?.map((img, idx) => (
                    <div key={idx} className="relative aspect-square group rounded-xl overflow-hidden border border-white/10">
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
                      className="aspect-square border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-1 text-gray-500 hover:border-neon-lime/50 hover:text-neon-lime transition-all disabled:opacity-60"
                    >
                      <Plus size={18} />
                      <span className="text-[9px] font-bold">
                        {isUploadingMedia ? '업로드 중' : '추가'}
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

          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-gray-400 mb-3">
              <Globe size={14} className="text-neon-lime" />
              <span>{labels.language}</span>
            </div>
            <select
              value={language}
              onChange={(event) =>
                onLanguageChange(event.target.value as LanguageOption)
              }
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-neon-lime"
            >
              <option value="en">English</option>
              <option value="ko">한국어</option>
            </select>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="w-full flex items-center justify-between px-4 py-3.5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Crown size={16} className="text-neon-lime" />
                <span className="text-sm">{labels.subscription}</span>
              </div>
              <span className="text-[11px] text-gray-400">{labels.choosePlan}</span>
            </div>

            {usage && (() => {
              const planKey = profile?.billingPlan || 'explorer';
              const limits = PLAN_LIMITS[planKey] || PLAN_LIMITS.explorer;
              const resources = Object.entries(limits).filter(
                ([, lim]) => lim > 0,
              );
              if (resources.length === 0) return null;
              return (
                <div className="px-4 py-3 border-b border-white/10 space-y-2">
                  <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">
                    이번 달 사용량
                  </p>
                  {resources.map(([key, lim]) => {
                    const cur = (usage as Record<string, number>)[key] ?? 0;
                    const pct = Math.min((cur / lim) * 100, 100);
                    const color =
                      pct >= 100
                        ? 'bg-red-500'
                        : pct >= 80
                          ? 'bg-amber-400'
                          : 'bg-neon-lime';
                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-gray-400">
                            {RESOURCE_LABELS[key] || key}
                          </span>
                          <span
                            className={
                              pct >= 100
                                ? 'text-red-400'
                                : pct >= 80
                                  ? 'text-amber-300'
                                  : 'text-gray-300'
                            }
                          >
                            {cur} / {lim}
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
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

            <div className="px-4 py-3.5 border-b border-white/10 space-y-2">
              {PLANS.map((item) => {
                const currentPlan = profile?.billingPlan || 'explorer';
                const isCurrent = item.plan === currentPlan;
                const isLoading = loadingPlan === item.plan;
                return (
                  <div
                    key={item.plan}
                    className={`rounded-xl border bg-black/30 px-3 py-2.5 ${isCurrent ? 'border-neon-lime/30' : 'border-white/10'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-white font-medium">{item.title}</p>
                        <p className="text-[11px] text-gray-400">{item.price}</p>
                      </div>
                      {isCurrent ? (
                        <span className="text-[10px] text-neon-lime font-bold border border-neon-lime/30 rounded-full px-2 py-0.5">
                          현재 플랜
                        </span>
                      ) : (
                        <button
                          onClick={() => handleCheckout(item.plan)}
                          disabled={loadingPlan !== null}
                          className="inline-flex items-center gap-1 text-xs text-neon-lime hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 size={13} className="animate-spin" />
                              {labels.redirecting}
                            </>
                          ) : (
                            labels.checkout
                          )}
                        </button>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5">
                      {item.features.map((f) => (
                        <span key={f} className="text-[10px] text-gray-500">{f}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
              {checkoutError && (
                <p className="text-xs text-red-300 pt-1">{checkoutError}</p>
              )}
            </div>

            <div className="px-4 py-3.5">
              <div className="flex items-center gap-2 text-xs text-gray-300 mb-2">
                <ShieldCheck size={14} className="text-neon-lime" />
                <span>{labels.polarPolicyTitle}</span>
              </div>
              <ul className="space-y-1.5 text-[12px] text-gray-400">
                <li>{labels.ruleDigitalOnly}</li>
                <li>{labels.ruleNoHumanService}</li>
                <li>{labels.ruleNoDonation}</li>
                <li>{labels.ruleInstantAccess}</li>
              </ul>
            </div>

            <div className="px-4 py-3.5 border-t border-white/10">
              <div className="flex items-center gap-2 text-xs text-gray-300 mb-2">
                <ShieldCheck size={14} className="text-neon-lime" />
                <span>{labels.legalTitle}</span>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                {labels.legalHint}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                <a
                  href="/terms"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-neon-lime hover:border-neon-lime/40"
                >
                  {labels.terms}
                </a>
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-neon-lime hover:border-neon-lime/40"
                >
                  {labels.privacy}
                </a>
                <a
                  href="/refund"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-neon-lime hover:border-neon-lime/40"
                >
                  {labels.refund}
                </a>
              </div>
            </div>
          </section>

          {/* 로그아웃 */}
          <section className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            {showLogoutConfirm ? (
              <div className="p-4 space-y-3">
                <p className="text-sm text-gray-300">로그아웃 하시겠습니까?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowLogoutConfirm(false)}
                    className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-medium transition-all"
                  >
                    취소
                  </button>
                  <button
                    onClick={onLogout}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-medium transition-all"
                  >
                    로그아웃
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 text-gray-500 hover:text-red-400 hover:bg-red-500/5 transition-all"
              >
                <LogOut size={16} />
                <span className="text-sm">로그아웃</span>
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
