import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoadingIndicator } from './ui/LoadingIndicator';

export interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingIndicator message="Verifying session..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login page preserving target return path
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
