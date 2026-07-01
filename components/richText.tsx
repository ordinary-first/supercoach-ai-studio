import type { ReactNode } from 'react';

export const renderBoldText = (text: string): ReactNode[] =>
  text.split(/(\*\*[^*]+\*\*)/).map((segment, idx) =>
    segment.startsWith('**') && segment.endsWith('**')
      ? <strong key={idx} className="text-th-accent font-bold">{segment.slice(2, -2)}</strong>
      : segment
  );
