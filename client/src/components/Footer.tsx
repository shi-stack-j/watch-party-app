import React from 'react';
import { Tv } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-800 bg-slate-950/80 py-10 mt-auto">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="space-y-3 md:col-span-2">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-indigo-600 rounded-lg">
              <Tv className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold text-slate-100">SyncStream Party</span>
          </div>
          <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
            Real-time synchronized YouTube watch parties with custom room roles, participant management, approval queues, and live interactive chat.
          </p>
        </div>

        <div className="space-y-2 text-xs">
          <h4 className="font-semibold text-slate-300 uppercase tracking-wider">Navigation</h4>
          <ul className="space-y-1.5 text-slate-400">
            <li><Link to="/" className="hover:text-indigo-400 transition">Home</Link></li>
            <li><Link to="/dashboard" className="hover:text-indigo-400 transition">Dashboard</Link></li>
            <li><Link to="/login" className="hover:text-indigo-400 transition">Sign In</Link></li>
            <li><Link to="/signup" className="hover:text-indigo-400 transition">Create Account</Link></li>
          </ul>
        </div>

        <div className="space-y-2 text-xs">
          <h4 className="font-semibold text-slate-300 uppercase tracking-wider">System Info</h4>
          <p className="text-slate-400">Phase 2 Frontend Release</p>
          <p className="text-slate-400">React + TypeScript + Vite + Tailwind v4</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-8 mt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
        <p>&copy; {new Date().getFullYear()} SyncStream. All rights reserved.</p>
        <p className="text-slate-400">Production-Grade Frontend Architecture</p>
      </div>
    </footer>
  );
};
