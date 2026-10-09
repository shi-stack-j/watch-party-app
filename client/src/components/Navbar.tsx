import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Tv, LogIn, UserPlus, LogOut, LayoutDashboard, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button } from './ui/Button';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    addToast('You have been logged out', 'info');
    navigate('/login');
  };

  return (
    <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-40 px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center space-x-2.5 group">
          <div className="p-2 bg-indigo-600 rounded-xl shadow-md shadow-indigo-600/20 group-hover:scale-105 transition transform">
            <Tv className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-slate-100 tracking-tight group-hover:text-indigo-400 transition">
            SyncStream <span className="text-indigo-400 font-medium text-xs border border-indigo-500/30 px-1.5 py-0.5 rounded ml-1">Party</span>
          </span>
        </Link>

        {/* Links & Actions */}
        <div className="flex items-center space-x-6 text-sm font-medium">
          <a href="#features" className="text-slate-400 hover:text-slate-200 transition hidden md:inline-block">
            Features
          </a>
          <a href="#how-it-works" className="text-slate-400 hover:text-slate-200 transition hidden md:inline-block">
            How It Works
          </a>

          {isAuthenticated && user ? (
            <div className="flex items-center space-x-3">
              <Link to="/dashboard">
                <Button variant="secondary" size="sm" leftIcon={<LayoutDashboard className="w-4 h-4" />}>
                  Dashboard
                </Button>
              </Link>
              <div className="hidden sm:flex items-center space-x-1.5 text-xs text-slate-300 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                <UserIcon className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-semibold">{user.username}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout} title="Log out">
                <LogOut className="w-4 h-4 text-slate-400 hover:text-rose-400" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <Link to="/login">
                <Button variant="ghost" size="sm" leftIcon={<LogIn className="w-4 h-4" />}>
                  Log In
                </Button>
              </Link>
              <Link to="/signup">
                <Button variant="primary" size="sm" leftIcon={<UserPlus className="w-4 h-4" />}>
                  Get Started
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
