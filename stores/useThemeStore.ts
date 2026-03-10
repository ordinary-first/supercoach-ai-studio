import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeState {
  preference: ThemePreference;
  resolved: 'light' | 'dark';
  setTheme: (pref: ThemePreference) => void;
}

const resolveTheme = (pref: ThemePreference): 'light' | 'dark' => {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return pref;
};

const applyTheme = (resolved: 'light' | 'dark'): void => {
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
  }
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) {
    meta.content = resolved === 'dark' ? '#111214' : '#F8FAFC';
  }
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: 'dark',
      resolved: resolveTheme('dark'),
      setTheme: (pref) => {
        const resolved = resolveTheme(pref);
        applyTheme(resolved);
        set({ preference: pref, resolved });
      },
    }),
    {
      name: 'secretcoach-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          const resolved = resolveTheme(state.preference);
          applyTheme(resolved);
          if (resolved !== state.resolved) {
            state.resolved = resolved;
          }
        }
      },
    }
  )
);

export const useSystemThemeListener = (store: typeof useThemeStore): (() => void) => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const handler = () => {
    const { preference, setTheme } = store.getState();
    if (preference === 'system') {
      setTheme('system');
    }
  };

  mediaQuery.addEventListener('change', handler);
  return () => mediaQuery.removeEventListener('change', handler);
};
