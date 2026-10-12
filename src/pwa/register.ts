import { registerSW } from 'virtual:pwa-register';
import { isUpdateReady, markUpdateReady, shouldReloadNow } from './updates';

const UPDATE_CHECK_MS = 60 * 60 * 1000;

/**
 * Registers the service worker (vite.config.ts sets injectRegister: false). A new build marks the
 * update ready instead of reloading mid-screen; UpdateGate swaps it in on the next screen change.
 * Checks for a new build whenever the app comes back to the foreground, and hourly.
 */
export function registerAppServiceWorker() {
  registerSW({
    immediate: true,
    onNeedReload() {
      markUpdateReady();
      reloadIfHidden();
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update();
        else if (isUpdateReady()) reloadIfHidden();
      });
      setInterval(() => registration.update(), UPDATE_CHECK_MS);
    },
  });
}

function reloadIfHidden() {
  if (shouldReloadNow({ hidden: document.hidden, pathname: window.location.pathname })) window.location.reload();
}
