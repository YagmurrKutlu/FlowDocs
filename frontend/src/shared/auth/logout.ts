import { useAuthStore } from '../../store/auth.store';

/** Clears persisted auth on this device only (local session). */
export function logoutCurrentDevice(): void {
  useAuthStore.getState().clearAuth();
}
