import React from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="py-20 text-center space-y-6">
      <h1 className="text-7xl font-extrabold gradient-text">404</h1>
      <h2 className="text-2xl font-bold text-slate-200">Page Not Found</h2>
      <p className="text-slate-400 max-w-md mx-auto">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        to="/"
        className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition"
      >
        <Home className="w-4 h-4" />
        <span>Return Home</span>
      </Link>
    </div>
  );
};
