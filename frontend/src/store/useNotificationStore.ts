'use client';
import { create } from 'zustand';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

interface NotificationState {
  notifications: Notification[];
  toasts: Notification[];
  addNotification: (type: NotificationType, title: string, message: string) => void;
  removeToast: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  toasts: [],

  addNotification: (type, title, message) => {
    const notif: Notification = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      type, title, message,
      timestamp: Date.now(),
      read: false,
    };
    set((s) => ({
      notifications: [notif, ...s.notifications].slice(0, 50),
      toasts: [notif, ...s.toasts].slice(0, 5),
    }));
    // 5초 후 토스트 자동 제거
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== notif.id) }));
    }, 5000);
  },

  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    })),

  clearAll: () => set({ notifications: [], toasts: [] }),
}));
