import React from 'react';
import { ToastMessage } from '../../types';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2 max-w-sm w-full px-4 sm:px-0">
      {toasts.map((toast) => {
        const icons = {
          success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
          error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
          warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
          info: <Info className="w-5 h-5 text-indigo-400 shrink-0" />,
        };

        const borders = {
          success: 'border-emerald-500/30 bg-slate-900/95',
          error: 'border-rose-500/30 bg-slate-900/95',
          warning: 'border-amber-500/30 bg-slate-900/95',
          info: 'border-indigo-500/30 bg-slate-900/95',
        };

        return (
          <div
            key={toast.id}
            className={`flex items-start justify-between p-4 rounded-xl border shadow-xl backdrop-blur-md transition transform duration-200 ${borders[toast.type]}`}
          >
            <div className="flex items-start space-x-3">
              {icons[toast.type]}
              <div>
                {toast.title && <h4 className="text-sm font-semibold text-slate-100">{toast.title}</h4>}
                <p className="text-xs text-slate-300 leading-relaxed">{toast.message}</p>
              </div>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-slate-400 hover:text-slate-200 p-0.5 rounded transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
