import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

type CrmTheme = 'dark' | 'light';

const STORAGE_KEY = 'xtenzium-crm-theme';

interface CrmThemeApi {
  theme: CrmTheme;
  toggleTheme: () => void;
}

const CrmThemeContext = createContext<CrmThemeApi | null>(null);

/* Deliberately separate from the marketing site's ThemeContext, which
   stamps `data-theme` on <html> and follows the OS. The CRM defaults
   dark regardless of the OS — it's a tool you sit in front of all day,
   not a page you land on — and toggling it here must not repaint the
   public site in another tab. Different key, different attribute,
   different element. */
export const CrmThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<CrmTheme>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* Private mode or blocked storage — the theme still applies for
         this session, it just won't be remembered. Not worth failing. */
    }
  }, [theme]);

  /* The marketing stylesheet sets `body { cursor: none }` for its custom
     cursor, which is not mounted on CRM routes. An inline style is the
     only thing that reliably beats it — a stylesheet rule would need
     `:has()` to reach the body from in here, and that gets stripped at
     build time. Restored on unmount so the public site is untouched. */
  useEffect(() => {
    const previous = document.body.style.cursor;
    document.body.style.cursor = 'auto';
    return () => {
      document.body.style.cursor = previous;
    };
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  const api = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return <CrmThemeContext.Provider value={api}>{children}</CrmThemeContext.Provider>;
};

export const useCrmTheme = (): CrmThemeApi => {
  const ctx = useContext(CrmThemeContext);
  if (!ctx) throw new Error('useCrmTheme must be used inside a CrmThemeProvider');
  return ctx;
};
