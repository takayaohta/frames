// PWA utility functions for testing and debugging

export const checkPWASupport = () => {
  const support = {
    serviceWorker: 'serviceWorker' in navigator,
    pushManager: 'PushManager' in window,
    notifications: 'Notification' in window,
    beforeInstallPrompt: false, // This will be updated by the install prompt component
    standalone: window.matchMedia('(display-mode: standalone)').matches,
    // Additional PWA checks
    isSecure: window.location.protocol === 'https:' || window.location.hostname === 'localhost',
    hasManifest: !!document.querySelector('link[rel="manifest"]'),
    hasServiceWorker: false, // Will be updated
  };

  return support;
};

// Global variable to track beforeInstallPrompt
let beforeInstallPromptEvent: any = null;

// Function to set beforeInstallPrompt event
export const setBeforeInstallPrompt = (event: any) => {
  beforeInstallPromptEvent = event;
};

// Function to get beforeInstallPrompt status
export const getBeforeInstallPrompt = () => {
  return beforeInstallPromptEvent !== null;
};

// Function to trigger install prompt
export const triggerInstallPrompt = async () => {
  if (beforeInstallPromptEvent) {
    beforeInstallPromptEvent.prompt();
    const { outcome } = await beforeInstallPromptEvent.userChoice;
    beforeInstallPromptEvent = null;
    return outcome;
  }
  return null;
};

export const getServiceWorkerRegistration = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      return registration;
    } catch (error) {
      console.error('Error getting service worker registration:', error);
      return null;
    }
  }
  return null;
};

// Enhanced PWA support check with service worker status
export const getEnhancedPWASupport = async () => {
  const support = checkPWASupport();
  const registration = await getServiceWorkerRegistration();
  
  support.hasServiceWorker = !!registration;
  support.beforeInstallPrompt = getBeforeInstallPrompt();
  
  return support;
};

export const clearAllCaches = async () => {
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
      console.log('All caches cleared');
    } catch (error) {
      console.error('Error clearing caches:', error);
    }
  }
};

export const getCacheInfo = async () => {
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      const cacheInfo = await Promise.all(
        cacheNames.map(async (cacheName) => {
          const cache = await caches.open(cacheName);
          const keys = await cache.keys();
          return {
            name: cacheName,
            size: keys.length,
            keys: keys.map(key => key.url)
          };
        })
      );
      return cacheInfo;
    } catch (error) {
      console.error('Error getting cache info:', error);
      return [];
    }
  }
  return [];
};

export const requestNotificationPermission = async () => {
  if ('Notification' in window) {
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied';
    }
  }
  return 'unsupported';
};

export const showTestNotification = () => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Frames PWA Test', {
      body: 'This is a test notification from Frames PWA',
      icon: '/logo192.png',
      badge: '/logo192.png'
    });
  }
};

// Debug function to log PWA status
export const logPWAStatus = async () => {
  const support = checkPWASupport();
  const registration = await getServiceWorkerRegistration();
  const cacheInfo = await getCacheInfo();

  console.log('=== PWA Status ===');
  console.log('Support:', support);
  console.log('Service Worker Registration:', registration);
  console.log('Cache Info:', cacheInfo);
  console.log('==================');
}; 