import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type UserTheme = 'dark' | 'light';

type UserThemeContextValue = {
  theme: UserTheme;
  isLight: boolean;
  setTheme: (next: UserTheme) => void;
  toggleTheme: () => void;
};

const STORAGE_KEY = 'tucancha:user-theme';

const UserThemeContext = createContext<UserThemeContextValue | null>(null);

const sanitizeTheme = (value: unknown): UserTheme => (value === 'light' ? 'light' : 'dark');

export function UserThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<UserTheme>(() => {
    if (typeof window === 'undefined') return 'dark';
    try {
      return sanitizeTheme(window.localStorage.getItem(STORAGE_KEY));
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // noop
    }
    const root = document.documentElement;
    root.dataset.userTheme = theme;
    root.classList.toggle('tc-global-light', theme === 'light');
  }, [theme]);

  const setTheme = useCallback((next: UserTheme) => {
    setThemeState(sanitizeTheme(next));
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => (current === 'light' ? 'dark' : 'light'));
  }, []);

  const value = useMemo<UserThemeContextValue>(() => ({
    theme,
    isLight: theme === 'light',
    setTheme,
    toggleTheme,
  }), [setTheme, theme, toggleTheme]);

  return <UserThemeContext.Provider value={value}>{children}</UserThemeContext.Provider>;
}

export const useUserTheme = () => {
  const context = useContext(UserThemeContext);
  if (!context) {
    throw new Error('useUserTheme must be used inside UserThemeProvider');
  }
  return context;
};
