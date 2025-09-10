import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export function useQueryParams() {
  const location = useLocation();
  const navigate = useNavigate();

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const get = (key, fallback = '') => params.get(key) ?? fallback;
  const set = (next) => {
    const p = new URLSearchParams(location.search);
    Object.entries(next).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') p.delete(k);
      else p.set(k, String(v));
    });
    navigate({ search: p.toString() }, { replace: true });
  };

  return { params, get, set };
}
