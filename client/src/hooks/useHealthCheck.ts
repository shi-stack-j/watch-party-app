import { useState, useEffect } from 'react';
import { HealthCheckData } from '../types';
import { getHealthStatus } from '../services/healthApi';

export const useHealthCheck = () => {
  const [health, setHealth] = useState<HealthCheckData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getHealthStatus();
      if (res.success && res.data) {
        setHealth(res.data);
      } else {
        setError(res.message || 'Failed to get health status');
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unable to reach backend server');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return { health, loading, error, refetch: fetchHealth };
};
