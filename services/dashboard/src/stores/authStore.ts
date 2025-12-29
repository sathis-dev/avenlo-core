import { create } from 'zustand';

interface User {
  id: string;
  username: string;
  discriminator: string;
  avatar: string;
  email?: string;
  roles: string[];
  isAdmin: boolean;
  isModerator: boolean;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: () => void;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  error: null,

  login: () => {
    window.location.href = '/auth/discord';
  },

  logout: async () => {
    try {
      await fetch('/auth/logout', { method: 'POST' });
      set({ user: null });
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  },

  fetchUser: async () => {
    try {
      set({ isLoading: true });
      const response = await fetch('/api/auth/me');
      
      if (response.ok) {
        const user = await response.json();
        set({ user, isLoading: false, error: null });
      } else {
        set({ user: null, isLoading: false });
      }
    } catch (error) {
      set({ user: null, isLoading: false, error: 'Failed to fetch user' });
    }
  },
}));

// Initialize auth check
useAuthStore.getState().fetchUser();
