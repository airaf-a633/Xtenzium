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
