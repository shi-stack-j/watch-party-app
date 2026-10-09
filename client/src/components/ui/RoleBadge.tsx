import React from 'react';
import { UserRole } from '../../types';
import { Crown, Shield, User as UserIcon } from 'lucide-react';

export interface RoleBadgeProps {
  role: UserRole;
  size?: 'sm' | 'md';
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, size = 'sm' }) => {
  const configs = {
    HOST: {
      label: 'Host',
      icon: <Crown className="w-3 h-3 text-amber-400 shrink-0" />,
      styles: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    },
    MODERATOR: {
      label: 'Moderator',
      icon: <Shield className="w-3 h-3 text-indigo-400 shrink-0" />,
      styles: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300',
    },
    PARTICIPANT: {
      label: 'Participant',
      icon: <UserIcon className="w-3 h-3 text-slate-400 shrink-0" />,
      styles: 'bg-slate-800 border-slate-700 text-slate-400',
    },
  };

  const current = configs[role] || configs.PARTICIPANT;
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center space-x-1 font-semibold border rounded-md ${padding} ${current.styles}`}
    >
      {current.icon}
      <span>{current.label}</span>
    </span>
  );
};
