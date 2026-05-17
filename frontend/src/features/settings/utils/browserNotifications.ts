const FLOWDOCS_ICON = '/favicon.ico';

export async function requestBrowserNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission === 'denied') {
    return false;
  }
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function isBrowserNotificationGranted(): boolean {
  return (
    isBrowserNotificationSupported() && Notification.permission === 'granted'
  );
}

export function showFlowDocsBrowserNotification(options: {
  title: string;
  body: string;
  tag?: string;
}): void {
  if (!isBrowserNotificationGranted()) {
    return;
  }
  try {
    const notification = new Notification(options.title, {
      body: options.body,
      icon: FLOWDOCS_ICON,
      tag: options.tag,
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // ignore — permission revoked or blocked
  }
}

export function truncateNotificationBody(text: string, max = 120): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}
