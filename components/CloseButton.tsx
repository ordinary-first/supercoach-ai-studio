import React from 'react';
import { X } from 'lucide-react';

interface CloseButtonProps {
  onClick: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: { icon: 18, padding: 'p-1.5' },
  md: { icon: 24, padding: 'p-2.5' },
  lg: { icon: 28, padding: 'p-3' },
};

const CloseButton: React.FC<CloseButtonProps> = ({ onClick, size = 'md', className = '' }) => {
  const { icon, padding } = sizeMap[size];
  return (
    <button
      onClick={onClick}
      className={`${padding} rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all hover:rotate-90 duration-300 ${className}`}
      aria-label="닫기"
    >
      <X size={icon} />
    </button>
  );
};

export default CloseButton;
