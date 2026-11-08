import React from 'react';

/**
 * Current view kept in the URL hash (#consult). Each navigation pushes a history entry,
 * so the Android back gesture returns to the previous view instead of leaving the app.
 */
export function useHashView<T extends string>(views: readonly T[], fallback: T): [T, (view: T) => void] {
  const read = React.useCallback((): T => {
    const hash = window.location.hash.slice(1) as T;
    return views.includes(hash) ? hash : fallback;
  }, [views, fallback]);

  const [view, setView] = React.useState<T>(read);

  React.useEffect(() => {
    const sync = () => setView(read());
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, [read]);

  const navigate = React.useCallback(
    (next: T) => {
      if (next === read()) return;
      history.pushState(null, '', `#${next}`);
      setView(next);
    },
    [read],
  );

  return [view, navigate];
}
