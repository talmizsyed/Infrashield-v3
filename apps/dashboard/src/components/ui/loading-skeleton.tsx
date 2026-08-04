import type { ReactElement } from 'react';
import { cn } from '../../lib/utils';

interface LoadingSkeletonProps {
  className?: string;
}

export function LoadingSkeleton({ className }: LoadingSkeletonProps): ReactElement {
  return <div className={cn('animate-pulse rounded-2xl bg-slate-800/70', className)} />;
}
