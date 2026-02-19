import React, { useEffect, useState } from 'react';
import { Loader2, Star, X } from 'lucide-react';
import type { Review, UserProfile } from '../types';
import { loadMyReview, saveReviewViaApi } from '../services/firebaseService';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  userId: string | null;
  onSuccess?: () => void;
}

const ReviewModal: React.FC<ReviewModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  userId,
  onSuccess,
}) => {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [text, setText] = useState('');
  const [userRole, setUserRole] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [existingReview, setExistingReview] = useState<Review | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // Load existing review on open
  useEffect(() => {
    if (!isOpen || !userId) return;
    let cancelled = false;
    setIsLoading(true);
    loadMyReview(userId).then((review) => {
      if (cancelled) return;
      if (review) {
        setExistingReview(review);
        setRating(review.rating);
        setText(review.text);
        setUserRole(review.userRole || '');
      }
      setIsLoading(false);
    }).catch(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [isOpen, userId]);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setSubmitted(false);
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!text.trim() || text.trim().length < 5) {
      setError('후기를 5자 이상 작성해주세요.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      await saveReviewViaApi({
        rating,
        text: text.trim(),
        userRole: userRole.trim() || undefined,
      });
      setSubmitted(true);
      onSuccess?.();
    } catch (err: any) {
      setError(err?.message || '후기 저장에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#0a0f1a] border border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">
            {existingReview ? '후기 수정' : '후기 작성'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all"
          >
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-gray-500" />
          </div>
        ) : submitted ? (
          /* Success state */
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-neon-lime/10 border border-neon-lime/30 flex items-center justify-center">
              <Star size={28} className="text-neon-lime fill-neon-lime" />
            </div>
            <h3 className="text-lg font-bold text-white">
              감사합니다!
            </h3>
            <p className="text-sm text-gray-400">
              소중한 후기가 등록되었습니다.
              <br />
              다른 사용자들에게 큰 도움이 됩니다.
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-8 py-3 bg-neon-lime text-black font-bold text-sm rounded-full hover:bg-white transition-all"
            >
              확인
            </button>
          </div>
        ) : (
          /* Form */
          <>
            {/* User info preview */}
            <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
              {userProfile.avatarUrl ? (
                <img
                  src={userProfile.avatarUrl}
                  alt=""
                  className="w-10 h-10 rounded-full border border-white/10 object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-neon-lime/20 flex items-center justify-center text-sm font-bold text-neon-lime">
                  {userProfile.name?.[0] || '?'}
                </div>
              )}
              <div>
                <p className="text-sm font-bold text-white">{userProfile.name}</p>
                <p className="text-[11px] text-gray-500">이름이 후기에 표시됩니다</p>
              </div>
            </div>

            {/* Star rating */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                만족도
              </label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star
                      size={28}
                      className={`transition-colors ${
                        star <= (hoverRating || rating)
                          ? 'text-neon-lime fill-neon-lime'
                          : 'text-gray-700'
                      }`}
                    />
                  </button>
                ))}
                <span className="ml-2 text-sm text-gray-500">{rating}/5</span>
              </div>
            </div>

            {/* Role / occupation */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                직업/역할 <span className="text-gray-600">(선택)</span>
              </label>
              <input
                type="text"
                value={userRole}
                onChange={(e) => setUserRole(e.target.value.slice(0, 50))}
                placeholder="예: 프리랜서 디자이너, 직장인, 학생"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-neon-lime/40 transition-colors"
              />
            </div>

            {/* Review text */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                후기 내용
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 500))}
                placeholder="Secret Coach를 사용하면서 느낀 점을 자유롭게 적어주세요."
                rows={4}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-neon-lime/40 transition-colors resize-none"
              />
              <p className="text-[10px] text-gray-600 text-right">{text.length}/500</p>
            </div>

            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || text.trim().length < 5}
              className="w-full py-3.5 bg-neon-lime text-black font-bold text-sm rounded-full hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  저장 중...
                </>
              ) : existingReview ? (
                '후기 수정하기'
              ) : (
                '후기 등록하기'
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ReviewModal;
