import { create } from 'zustand';

type ThemeMode = 'light' | 'dark';

interface NotificationState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info' | 'warning';
}

interface AppState {
  themeMode: ThemeMode;
  toggleTheme: () => void;
  
  notification: NotificationState;
  showNotification: (message: string, severity?: NotificationState['severity']) => void;
  closeNotification: () => void;
  
  globalStartDate: string;
  globalEndDate: string;
  setGlobalDateRange: (start: string, end: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  themeMode: (localStorage.getItem('kliimora_theme') as ThemeMode) || 'light',
  toggleTheme: () => set((state) => {
    const newMode = state.themeMode === 'light' ? 'dark' : 'light';
    localStorage.setItem('kliimora_theme', newMode);
    return { themeMode: newMode };
  }),
  
  notification: { open: false, message: '', severity: 'info' },
  showNotification: (message, severity = 'success') => set({ notification: { open: true, message, severity } }),
  closeNotification: () => set((state) => ({ notification: { ...state.notification, open: false } })),
  
  globalStartDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
  globalEndDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
  setGlobalDateRange: (start, end) => set({ globalStartDate: start, globalEndDate: end }),
}));
