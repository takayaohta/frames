import React, { useState, useEffect } from 'react';
import { 
  checkPWASupport, 
  getServiceWorkerRegistration, 
  clearAllCaches, 
  getCacheInfo, 
  requestNotificationPermission, 
  showTestNotification,
  logPWAStatus,
  getBeforeInstallPrompt,
  triggerInstallPrompt,
  getEnhancedPWASupport
} from '../utils/pwa-utils';

const PWADebugPanel: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [pwaSupport, setPwaSupport] = useState<any>(null);
  const [cacheInfo, setCacheInfo] = useState<any[]>([]);
  const [swRegistration, setSwRegistration] = useState<any>(null);

  useEffect(() => {
    if (isVisible) {
      updatePWAInfo();
    }
  }, [isVisible]);

  const updatePWAInfo = async () => {
    const support = await getEnhancedPWASupport();
    const registration = await getServiceWorkerRegistration();
    const cacheInfo = await getCacheInfo();

    setPwaSupport(support);
    setSwRegistration(registration);
    setCacheInfo(cacheInfo);
  };

  const handleClearCaches = async () => {
    await clearAllCaches();
    await updatePWAInfo();
  };

  const handleRequestNotificationPermission = async () => {
    await requestNotificationPermission();
    await updatePWAInfo();
  };

  const handleShowTestNotification = () => {
    showTestNotification();
  };

  const handleLogPWAStatus = () => {
    logPWAStatus();
  };

  const handleTriggerInstall = async () => {
    const outcome = await triggerInstallPrompt();
    if (outcome) {
      console.log('Install prompt outcome:', outcome);
    }
    await updatePWAInfo();
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-50 bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-gray-500 border-r-gray-500 text-black text-xs px-2 py-1 hover:bg-gray-300 active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white active:translate-x-px active:translate-y-px"
      >
        PWA Debug
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 max-h-96 overflow-y-auto">
      <div className="bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-gray-500 border-r-gray-500 shadow-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-black">PWA Debug Panel</h3>
          <button
            onClick={() => setIsVisible(false)}
            className="text-black text-xs hover:bg-gray-300 px-1"
          >
            ×
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <h4 className="font-bold text-black mb-1">PWA Support:</h4>
            {pwaSupport && (
              <div className="space-y-1">
                {Object.entries(pwaSupport).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-black">{key}:</span>
                    <span className={value ? 'text-green-600' : 'text-red-600'}>
                      {String(value)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {pwaSupport && !pwaSupport.beforeInstallPrompt && (
              <div className="mt-2 p-2 bg-yellow-100 border border-yellow-300 text-yellow-800 text-xs">
                <strong>Note:</strong> Install prompt may not show in development. 
                Try Chrome DevTools → Application → Manifest → "Add to home screen" 
                or use "Trigger Install Prompt" button below.
              </div>
            )}
          </div>

          <div>
            <h4 className="font-bold text-black mb-1">Service Worker:</h4>
            <div className="text-black">
              {swRegistration ? 'Registered' : 'Not registered'}
            </div>
          </div>

          <div>
            <h4 className="font-bold text-black mb-1">Caches ({cacheInfo.length}):</h4>
            {cacheInfo.map((cache, index) => (
              <div key={index} className="mb-2 p-2 bg-gray-200">
                <div className="font-bold">{cache.name}</div>
                <div>Size: {cache.size} items</div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <button
              onClick={handleClearCaches}
              className="w-full bg-[#c0c0c0] border border-t-white border-l-white border-b-gray-500 border-r-gray-500 text-black text-xs px-2 py-1 hover:bg-gray-300 active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white active:translate-x-px active:translate-y-px"
            >
              Clear All Caches
            </button>
            <button
              onClick={handleRequestNotificationPermission}
              className="w-full bg-[#c0c0c0] border border-t-white border-l-white border-b-gray-500 border-r-gray-500 text-black text-xs px-2 py-1 hover:bg-gray-300 active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white active:translate-x-px active:translate-y-px"
            >
              Request Notification Permission
            </button>
            <button
              onClick={handleShowTestNotification}
              className="w-full bg-[#c0c0c0] border border-t-white border-l-white border-b-gray-500 border-r-gray-500 text-black text-xs px-2 py-1 hover:bg-gray-300 active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white active:translate-x-px active:translate-y-px"
            >
              Show Test Notification
            </button>
            <button
              onClick={handleLogPWAStatus}
              className="w-full bg-[#c0c0c0] border border-t-white border-l-white border-b-gray-500 border-r-gray-500 text-black text-xs px-2 py-1 hover:bg-gray-300 active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white active:translate-x-px active:translate-y-px"
            >
              Log PWA Status
            </button>
            <button
              onClick={handleTriggerInstall}
              className="w-full bg-[#c0c0c0] border border-t-white border-l-white border-b-gray-500 border-r-gray-500 text-black text-xs px-2 py-1 hover:bg-gray-300 active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white active:translate-x-px active:translate-y-px"
            >
              Trigger Install Prompt
            </button>
            <button
              onClick={updatePWAInfo}
              className="w-full bg-[#c0c0c0] border border-t-white border-l-white border-b-gray-500 border-r-gray-500 text-black text-xs px-2 py-1 hover:bg-gray-300 active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white active:translate-x-px active:translate-y-px"
            >
              Refresh Info
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PWADebugPanel; 