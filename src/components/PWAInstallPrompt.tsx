import React, { useState, useEffect } from 'react';
import { setBeforeInstallPrompt } from '../utils/pwa-utils';
import { motion } from 'framer-motion';

// デバイス判定関数
const isMobileDevice = () => {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
};

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Windows 98風ツールチップコンポーネント
const Win98Tooltip: React.FC<{ isVisible: boolean; children: React.ReactNode }> = ({ isVisible, children }) => {
  if (!isVisible) return null;

  return (
    <div
      style={{
        background: '#ffffcc',
        border: '1px solid #000',
        color: '#222',
        fontSize: '8px',
        fontFamily: 'monospace',
        paddingLeft: '0.5em',
        paddingRight: '0.5em',
        paddingTop: '0.3em',
        paddingBottom: '0.3em',
        boxShadow: 'none',
        zIndex: 1000,
        whiteSpace: 'nowrap',
        wordBreak: 'keep-all',
        position: 'absolute',
        left: '100%',
        top: '50%',
        transform: 'translateY(-50%)',
        marginLeft: 8,
        lineHeight: 1.5,
        display: 'inline-block',
      }}
    >
      {children}
    </div>
  );
};

// Windows 98風インストール確認ポップアップ
const Win98InstallConfirm: React.FC<{ 
  isVisible: boolean; 
  onConfirm: () => void; 
  onCancel: () => void; 
}> = ({ isVisible, onConfirm, onCancel }) => {
  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div className="bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-gray-500 border-r-gray-500 shadow-lg max-w-sm mx-4">
        {/* タイトルバー */}
        <div className="bg-[#000080] text-white px-2 py-1 flex justify-between items-center">
          <span className="text-sm font-bold">Install Frames</span>
          <button
            onClick={onCancel}
            className="w-4 h-4 bg-[#c0c0c0] border border-t-white border-l-white border-b-gray-500 border-r-gray-500 flex items-center justify-center hover:bg-gray-300"
          >
            <span className="text-black text-xs font-bold">×</span>
          </button>
        </div>
        {/* コンテンツ */}
        <div className="p-4">
          <div className="flex items-start mb-4">
            <div className="w-8 h-8 bg-[#000080] flex items-center justify-center mr-3 flex-shrink-0">
              <span className="text-white text-xs font-bold">F</span>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-black mb-1">Install Frames Application</h3>
              <p className="text-xs text-black leading-tight">
                Install Frames to your desktop for quick access and offline use.
              </p>
            </div>
          </div>
          {/* 機能リスト */}
          <div className="mb-4 space-y-1">
            <div className="flex items-center text-xs text-black">
              <span className="w-1 h-1 bg-black rounded-full mr-2"></span>
              Offline photo editing
            </div>
            <div className="flex items-center text-xs text-black">
              <span className="w-1 h-1 bg-black rounded-full mr-2"></span>
              Quick app launch from desktop
            </div>
            <div className="flex items-center text-xs text-black">
              <span className="w-1 h-1 bg-black rounded-full mr-2"></span>
              Native app experience
            </div>
          </div>
          {/* ボタン群 */}
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-1 bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-gray-500 border-r-gray-500 text-black text-sm font-normal shadow-sm active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white active:translate-x-px active:translate-y-px select-none min-w-[60px] min-h-[24px]"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-1 bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-gray-500 border-r-gray-500 text-black text-sm font-normal shadow-sm active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white active:translate-x-px active:translate-y-px select-none min-w-[60px] min-h-[24px]"
            >
              Install
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Update PWA utils
      setBeforeInstallPrompt(e as BeforeInstallPromptEvent);
      // Show the install prompt
      setShowInstallPrompt(true);
    };

    const handleAppInstalled = () => {
      // Hide the install prompt
      setShowInstallPrompt(false);
      // Clear the deferredPrompt
      setDeferredPrompt(null);
      console.log('PWA was installed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }

    // Clear the deferredPrompt
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
    setShowConfirmPopup(false);
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    setDeferredPrompt(null);
  };

  const handleIconClick = () => {
    setShowConfirmPopup(true);
  };

  if (!showInstallPrompt) return null;

  // PC版とモバイル版で異なるレイアウト
  if (!isMobileDevice()) {
    // PC版: Windows 98風デスクトップアイコン
    return (
      <>
        <div className="fixed bottom-4 left-4 z-40">
          <div 
            className="relative group"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            {/* デスクトップアイコン */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-16 h-20 flex flex-col items-center cursor-pointer select-none"
              onClick={handleIconClick}
            >
              {/* アイコン - 縦線＋逆三角形（｜＋▼）隙間なし */}
              <div className="w-12 h-12 bg-[#000080] border-2 border-t-white border-l-white border-b-gray-500 border-r-gray-500 flex items-center justify-center mb-1 shadow-sm hover:shadow-md transition-shadow duration-200">
                <svg width="24" height="24" viewBox="0 0 24 24">
                  <g fill="white">
                    {/* 縦線（下端をy=15まで延長） */}
                    <rect x="11" y="4" width="2" height="12"/>
                    {/* 逆三角形（▼） */}
                    <rect x="7" y="16" width="10" height="2"/>
                    <rect x="9" y="18" width="6" height="2"/>
                    <rect x="11" y="20" width="2" height="2"/>
                  </g>
                </svg>
              </div>
              {/* ラベル */}
              <div className="text-center">
                <span className="text-xs text-black font-medium leading-tight">
                  Install
                </span>
              </div>
            </motion.div>

            {/* ツールチップ */}
            <Win98Tooltip isVisible={showTooltip}>
              Click to install Frames. Offline access, quick launch.
            </Win98Tooltip>
          </div>
        </div>

        {/* インストール確認ポップアップ */}
        <Win98InstallConfirm
          isVisible={showConfirmPopup}
          onConfirm={handleInstallClick}
          onCancel={() => setShowConfirmPopup(false)}
        />
      </>
    );
  }

  // モバイル版: 従来の下部表示（後で改善予定）
  return (
    <motion.div
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed bottom-4 left-4 right-4 z-50"
    >
      <div className="bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-gray-500 border-r-gray-500 shadow-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-sm font-bold text-black mb-1">Install Frames</h3>
            <p className="text-xs text-black">
              Install Frames for a better experience
            </p>
          </div>
          <div className="flex gap-2 ml-4">
            <button
              onClick={handleDismiss}
              className="px-3 py-1 text-xs bg-[#c0c0c0] border border-t-white border-l-white border-b-gray-500 border-r-gray-500 text-black hover:bg-gray-300 active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white active:translate-x-px active:translate-y-px"
            >
              Later
            </button>
            <button
              onClick={handleInstallClick}
              className="px-3 py-1 text-xs bg-[#c0c0c0] border border-t-white border-l-white border-b-gray-500 border-r-gray-500 text-black hover:bg-gray-300 active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white active:translate-x-px active:translate-y-px"
            >
              Install
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default PWAInstallPrompt; 