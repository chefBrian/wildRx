import { useSyncExternalStore } from 'react';

// A new build has taken over the service worker, but this page still runs the old code.
// `readyPath` is the screen the user was on when it arrived: they keep it, and the next
// screen change loads fresh (see UpdateGate). Admin gets a banner instead so unsaved edits survive.
let readyPath: string | null = null;
const listeners = new Set<() => void>();

export function markUpdateReady(path = currentPath()) {
  if (readyPath !== null) return;
  readyPath = path;
  listeners.forEach(l => l());
}

export function useUpdateReadyPath(): string | null {
  return useSyncExternalStore(subscribe, () => readyPath);
}

export function isUpdateReady(): boolean {
  return readyPath !== null;
}

/** A hidden calculator page reloads at once (nobody is looking); admin never auto-reloads. */
export function shouldReloadNow({ hidden, pathname }: { hidden: boolean; pathname: string }): boolean {
  return hidden && !isAdminPath(pathname);
}

export function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

/** Tests only. */
export function resetUpdateState() {
  readyPath = null;
  listeners.clear();
}

function currentPath(): string {
  return window.location.pathname + window.location.search + window.location.hash;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
