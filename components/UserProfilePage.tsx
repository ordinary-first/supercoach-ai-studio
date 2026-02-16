import React, { useRef, useState } from 'react';
import type { UserProfile } from '../types';
import {
  Calendar,
  Camera,
  ChevronRight,
  Image as ImageIcon,
  LogOut,
  MapPin,
  Plus,
  Quote,
  Save,
  Trash2,
  User,
} from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { uploadProfileGalleryImage } from '../services/aiService';
import { getUserId } from '../services/firebaseService';

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

interface UserProfilePageProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSave: (updatedProfile: UserProfile) => void;
  onLogout: () => void;
}

const UserProfilePage: React.FC<UserProfilePageProps> = ({
  isOpen,
  onClose,
  profile,
  onSave,
  onLogout,
}) => {
  const [formData, setFormData] = useState<UserProfile>({
    ...profile,
    bio: profile.bio || '',
    gallery: profile.gallery || [],
  });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const focusTrapRef = useFocusTrap(isOpen);

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
    for (const file of Array.from(files)) {
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

  return (
    <div
      ref={focusTrapRef}
      className="fixed inset-0 z-50 bg-deep-space flex flex-col overflow-hidden font-body text-white"
    >
      <div className="h-14 md:h-20 border-b border-white/10 flex items-center justify-between px-4 md:px-8 bg-black/20 backdrop-blur-md shrink-0 z-10">
        <div className="flex items-center gap-4">
          <div className="p-2 md:p-3 bg-neon-lime/10 rounded-lg md:rounded-xl">
            <User className="text-neon-lime w-5 h-5 md:w-8 md:h-8" />
          </div>
          <div>
            <h1 className="text-lg md:text-2xl font-display font-bold tracking-wider text-white">
              프로필
            </h1>
            <p className="text-[10px] text-gray-500 font-mono mt-0.5">개인 설정</p>
          </div>
        </div>
        <button
          onClick={() => {
            onSave(formData);
            onClose();
          }}
          className="flex items-center gap-2 px-5 py-2 bg-neon-lime text-black font-bold rounded-full hover:bg-white transition-all text-sm"
        >
          <Save size={16} /> 저장
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide z-10 pb-[120px]">
        <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 overflow-hidden">
                {hasAvatar ? (
                  <img src={formData.avatarUrl} className="w-full h-full object-cover" alt="avatar" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User size={32} className="text-gray-500" />
                  </div>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 p-1.5 bg-neon-lime text-black rounded-full shadow-lg hover:scale-110 transition-all"
                disabled={isUploadingMedia}
              >
                <Camera size={14} />
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
                className="bg-transparent text-xl font-bold text-white w-full focus:outline-none border-b border-transparent focus:border-neon-lime/30 pb-1 transition-colors"
                placeholder="이름을 입력하세요"
              />
              <p className="text-xs text-gray-500 mt-1">{formData.email}</p>
            </div>
          </div>

          <div className="bg-white/5 rounded-2xl border border-white/5 divide-y divide-white/5 overflow-hidden">
            <div className="flex items-center gap-4 p-4">
              <Calendar size={18} className="text-gray-500 shrink-0" />
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
            <div className="flex items-center gap-4 p-4">
              <User size={18} className="text-gray-500 shrink-0" />
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
              <ChevronRight size={16} className="text-gray-600" />
            </div>
            <div className="flex items-center gap-4 p-4">
              <MapPin size={18} className="text-gray-500 shrink-0" />
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

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-gray-400 text-xs font-bold">
              <Quote size={14} className="text-neon-lime" />
              자기소개
            </div>
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              placeholder="관심사와 목표를 적어주세요."
              className="w-full h-32 bg-white/5 border border-white/5 rounded-2xl p-4 text-sm text-gray-200 leading-relaxed focus:outline-none focus:border-neon-lime/30 transition-all resize-none"
            />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-gray-400 text-xs font-bold">
                <ImageIcon size={14} className="text-neon-lime" />
                포토 갤러리
              </div>
              <span className="text-[10px] text-gray-600">{formData.gallery?.length || 0} / 6</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
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
                  className="aspect-square border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-1.5 text-gray-500 hover:border-neon-lime/50 hover:text-neon-lime transition-all disabled:opacity-60"
                >
                  <Plus size={20} />
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

          <div className="pt-4">
            {showLogoutConfirm ? (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 space-y-3">
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
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-white/5 border border-white/5 rounded-2xl text-gray-500 hover:text-red-400 hover:bg-red-500/5 transition-all"
              >
                <LogOut size={16} />
                <span className="text-sm">로그아웃</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfilePage;
