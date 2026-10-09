import React from 'react';
import { Layers } from 'lucide-react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = <Layers className="w-10 h-10 text-slate-500" />,
  title,
  description,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
      <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/50">{icon}</div>
      <h3 className="text-base font-semibold text-slate-200">{title}</h3>
      <p className="text-xs text-slate-400 max-w-sm leading-relaxed">{description}</p>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
};
