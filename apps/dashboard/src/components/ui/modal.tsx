import type { ReactElement, ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface ModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, title, children, className }: ModalProps): ReactElement | null {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
      <div
        className={cn(
          'w-full max-w-xl rounded-3xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl',
          className,
        )}
      >
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
