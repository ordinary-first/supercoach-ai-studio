import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeState {
  preference: ThemePreference;
  resolved: 'light' | 'dark';
  setTheme: (pref: ThemePreference) => void;
}

const resolveTheme = (pref: ThemePreference): 'light' | 'dark' => {
  if (pref === 'system') {
    const scheme: ColorSchemeName = Appearance.getColorScheme();
    return scheme === 'dark' ? 'dark' : 'light';
  }
  return pref;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: 'dark',
      resolved: resolveTheme('dark'),
      setTheme: (pref) => {
        const resolved = resolveTheme(pref);
        set({ preference: pref, resolved });
      },
    }),
    {
      name: 'secretcoach-theme',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const resolved = resolveTheme(state.preference);
          if (resolved !== state.resolved) {
            state.resolved = resolved;
          }
        }
      },
    }
  )
);

/**
 * Subscribe to OS-level color scheme changes.
 * Call once at app root; returns an unsubscribe function.
 */
export const subscribeToSystemTheme = (): (() => void) => {
  const subscription = Appearance.addChangeListener(() => {
    const { preference, setTheme } = useThemeStore.getState();
    if (preference === 'system') {
      setTheme('system');
    }
  });
  return () => subscription.remove();
};
