'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';

interface AppStateContextValue {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  notifications: string[];
  setNotifications: (value: string[]) => void;
  selectedEnvironment: string;
  setSelectedEnvironment: (value: string) => void;
  filters: Record<string, string>;
  setFilters: (value: Record<string, string>) => void;
  refreshInterval: number;
  setRefreshInterval: (value: number) => void;
  userPreferences: Record<string, string | boolean | number>;
  setUserPreferences: (value: Record<string, string | boolean | number>) => void;
}

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);

export function AppStateProvider({ children }: { children: ReactNode }): ReactElement {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [notifications, setNotifications] = useState<string[]>(['2 new alerts']);
  const [selectedEnvironment, setSelectedEnvironment] = useState('prod');
  const [filters, setFilters] = useState<Record<string, string>>({ region: 'us-east-1' });
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [userPreferences, setUserPreferences] = useState<Record<string, string | boolean | number>>(
    {
      compactView: false,
      density: 'comfortable',
    },
  );

  const value = useMemo(
    () => ({
      theme,
      toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
      notifications,
      setNotifications,
      selectedEnvironment,
      setSelectedEnvironment,
      filters,
      setFilters,
      refreshInterval,
      setRefreshInterval,
      userPreferences,
      setUserPreferences,
    }),
    [theme, notifications, selectedEnvironment, filters, refreshInterval, userPreferences],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateContextValue {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }

  return context;
}
