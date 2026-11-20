import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../api/client';
import type { OutletSummary } from '../components/RestaurantCard';
import type { FeedDish, VegFacts } from '../utils/homeFeed';

export interface SearchResult {
  query: string;
  outlets: OutletSummary[];
  dishes: { outlet: OutletSummary; dish: FeedDish }[];
  vegByOutlet: Record<string, VegFacts>;
  cuisinesByOutlet: Record<string, string[]>;
  categoriesByOutlet: Record<string, string[]>;
}

export type SearchState =
  | { status: 'idle' }
  | { status: 'loading'; query: string }
  | { status: 'done'; result: SearchResult }
  | { status: 'error'; query: string };

/**
 * Backend search (restaurants, cuisines, categories, dishes) with a short debounce.
 * `submit` runs immediately (keyboard search button). Stale responses are ignored.
 */
export function useHomeSearch(query: string, coordinates: string, delayMs = 350) {
  const [state, setState] = useState<SearchState>({ status: 'idle' });
  const [nonce, setNonce] = useState(0);
  const latest = useRef(0);
  const term = query.trim();

  useEffect(() => {
    const id = ++latest.current;
    if (term.length < 2) {
      void Promise.resolve().then(() => { if (id === latest.current) setState({ status: 'idle' }); });
      return;
    }
    const run = () => {
      setState({ status: 'loading', query: term });
      const params = `q=${encodeURIComponent(term)}${coordinates ? '&' + coordinates.replace(/^\?/, '') : ''}`;
      apiRequest<SearchResult>(`/public/search?${params}`)
        .then(result => { if (id === latest.current) setState({ status: 'done', result }); })
        .catch(() => { if (id === latest.current) setState({ status: 'error', query: term }); });
    };
    const timer = setTimeout(run, nonce ? 0 : delayMs);
    return () => clearTimeout(timer);
  }, [term, coordinates, delayMs, nonce]);

  return { search: state, submitSearch: () => setNonce(n => n + 1) };
}
