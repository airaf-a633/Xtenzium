import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  EMPTY_VIEW,
  configToView,
  paramsToView,
  viewToConfig,
  viewToParams,
  type ViewState,
} from '../../lib/views';
import type { SavedView, TeamMember, ViewEntity } from '../../types/database';

/* The URL is the source of truth for the current view. A saved view is
   a stored copy of that state, applied by rewriting the URL — so
   there is exactly one code path that changes what a board shows, and
   the back button rewinds it for free.

   Params not owned by the view (`tab`, an open record's id, anything a
   page adds later) are preserved on every write. */
const VIEW_PARAMS = ['group', 'q', 'f', 's'];

export const useView = (entity: ViewEntity, me: TeamMember | null) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [viewsUnavailable, setViewsUnavailable] = useState(false);

  const view = useMemo(() => paramsToView(searchParams), [searchParams]);

  const setView = useCallback(
    (next: ViewState, options?: { keepActive?: boolean }) => {
      setSearchParams(
        current => {
          const params = new URLSearchParams(current);
          VIEW_PARAMS.forEach(key => params.delete(key));
          viewToParams(next).forEach((value, key) => params.append(key, value));
          return params;
        },
        { replace: true },
      );
      if (!options?.keepActive) setActiveViewId(null);
    },
    [setSearchParams],
  );

  const resetView = useCallback(() => setView({ ...EMPTY_VIEW }), [setView]);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('saved_views')
      .select('*')
      .eq('entity', entity)
      .order('position')
      .then(({ data, error }) => {
        if (cancelled) return;
        /* Migration 008 may not have been run yet. A missing table is
           not an error worth interrupting the page for — the board
           still works, it just can't remember a view. */
        if (error) {
          setViewsUnavailable(true);
          return;
        }
        setSavedViews((data ?? []) as SavedView[]);
      });
    return () => {
      cancelled = true;
    };
  }, [entity]);

  /* Only my own views, plus anything explicitly shared. */
  const visibleViews = useMemo(
    () => savedViews.filter(v => v.shared || (me && v.owner_id === me.id) || v.owner_id === null),
    [savedViews, me],
  );

  const applySavedView = useCallback(
    (id: string) => {
      const saved = savedViews.find(v => v.id === id);
      if (!saved) return;
      setView(configToView(saved.config), { keepActive: true });
      setActiveViewId(id);
    },
    [savedViews, setView],
  );

  const saveView = useCallback(
    async (name: string, shared: boolean): Promise<SavedView | null> => {
      const { data, error } = await supabase
        .from('saved_views')
        .insert({
          name: name.trim(),
          entity,
          config: viewToConfig(view),
          owner_id: me?.id ?? null,
          shared,
          position: savedViews.length,
        })
        .select()
        .single();
      if (error || !data) return null;
      const saved = data as SavedView;
      setSavedViews(list => [...list, saved]);
      setActiveViewId(saved.id);
      return saved;
    },
    [entity, view, me, savedViews.length],
  );

  /* Overwrite the active view with whatever is on screen now. */
  const updateActiveView = useCallback(async (): Promise<boolean> => {
    if (!activeViewId) return false;
    const { data, error } = await supabase
      .from('saved_views')
      .update({ config: viewToConfig(view) })
      .eq('id', activeViewId)
      .select()
      .single();
    if (error || !data) return false;
    setSavedViews(list => list.map(v => (v.id === activeViewId ? (data as SavedView) : v)));
    return true;
  }, [activeViewId, view]);

  const deleteView = useCallback(
    async (id: string): Promise<boolean> => {
      const { error } = await supabase.from('saved_views').delete().eq('id', id);
      if (error) return false;
      setSavedViews(list => list.filter(v => v.id !== id));
      if (activeViewId === id) setActiveViewId(null);
      return true;
    },
    [activeViewId],
  );

  const shareUrl = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    return `${window.location.origin}${window.location.pathname}${
      params.toString() ? `?${params.toString()}` : ''
    }`;
  }, [searchParams]);

  return {
    view,
    setView,
    resetView,
    savedViews: visibleViews,
    activeViewId,
    applySavedView,
    saveView,
    updateActiveView,
    deleteView,
    shareUrl,
    viewsUnavailable,
  };
};
