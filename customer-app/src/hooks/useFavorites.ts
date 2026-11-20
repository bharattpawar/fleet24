import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../api/client';

/**
 * Hearted restaurants, stored on the server per customer.
 * Toggle is optimistic and rolls back if the request fails.
 */
export function useFavorites(isAuthenticated: boolean) {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const version = useRef(0);

  useEffect(() => {
    const current = ++version.current;
    if (!isAuthenticated) {
      void Promise.resolve().then(() => { if (current === version.current) setIds(new Set()); });
      return;
    }
    apiRequest<{ outletIds: string[] }>('/customer/favorites')
      .then(data => { if (current === version.current) setIds(new Set(data.outletIds)); })
      .catch(() => { /* hearts simply start empty */ });
  }, [isAuthenticated]);

  const toggle = useCallback(async (outletId: string) => {
    const wasFavorite = ids.has(outletId);
    const apply = (favorite: boolean) => setIds(prev => {
      const next = new Set(prev);
      if (favorite) next.add(outletId); else next.delete(outletId);
      return next;
    });
    apply(!wasFavorite);
    setError('');
    try {
      await apiRequest(`/customer/favorites/${outletId}`, { method: wasFavorite ? 'DELETE' : 'PUT' });
    } catch {
      apply(wasFavorite);
      setError('Couldn’t update favourites. Try again.');
    }
  }, [ids]);

  return { favoriteIds: ids, toggleFavorite: toggle, favoritesError: error };
}
