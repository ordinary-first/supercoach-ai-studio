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
      className={`${padding} rounded-full bg-th-surface hover:bg-th-surface-hover text-th-text-secondary hover:text-th-text transition-all hover:rotate-90 duration-300 ${className}`}
      aria-label="Close"
    >
      <X size={icon} />
    </button>
  );
};

export default CloseButton;
