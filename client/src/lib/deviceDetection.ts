// NOTIFICATION SYSTEM COMPREHENSIVE AUDIT & FIX
// This addresses all the issues in your current notification setup

// 1. ENHANCED DEVICE DETECTION
// File: lib/deviceDetection.ts (UPDATED)
export interface DeviceInfo {
  isIOS: boolean;
  isAndroid: boolean;
  isMacOS: boolean;
  isWindows: boolean;
  isLinux: boolean;
  isMobile: boolean;
  isDesktop: boolean;
  isStandalone: boolean;
  isPWA: boolean;
  needsOneSignal: boolean;
  supportsWebPush: boolean;
  platform: 'ios' | 'android' | 'macos' | 'windows' | 'linux' | 'unknown';
  browser: 'chrome' | 'firefox' | 'safari' | 'edge' | 'opera' | 'unknown';
  version: string;
}

export function detectDevice(): DeviceInfo {
  const userAgent = navigator.userAgent.toLowerCase();
  
  // Enhanced platform detection
  const isIOS = /iphone|ipad|ipod/.test(userAgent);
  const isAndroid = /android/.test(userAgent);
  const isMacOS = /macintosh|mac os x/.test(userAgent) && !isIOS;
  const isWindows = /windows/.test(userAgent);
  const isLinux = /linux/.test(userAgent) && !isAndroid;
  
  // Device type
  const isMobile = isIOS || isAndroid || /mobile/.test(userAgent);
  const isDesktop = !isMobile;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                      (window.navigator as any).standalone === true;
  const isPWA = isStandalone;

  // Enhanced browser detection with version
  let browser: 'chrome' | 'firefox' | 'safari' | 'edge' | 'opera' | 'unknown' = 'unknown';
  let version = '';
  
  if (/edg/.test(userAgent)) {
    browser = 'edge';
    version = userAgent.match(/edg\/([0-9.]+)/)?.[1] || '';
  } else if (/chrome/.test(userAgent) && !/edg/.test(userAgent)) {
    browser = 'chrome';
    version = userAgent.match(/chrome\/([0-9.]+)/)?.[1] || '';
  } else if (/firefox/.test(userAgent)) {
    browser = 'firefox';
    version = userAgent.match(/firefox\/([0-9.]+)/)?.[1] || '';
  } else if (/safari/.test(userAgent) && !/chrome/.test(userAgent)) {
    browser = 'safari';
    version = userAgent.match(/version\/([0-9.]+)/)?.[1] || '';
  } else if (/opera/.test(userAgent)) {
    browser = 'opera';
    version = userAgent.match(/opera\/([0-9.]+)/)?.[1] || '';
  }

  // Enhanced notification support detection
  const supportsWebPush = 'serviceWorker' in navigator && 
                         'PushManager' in window && 
                         'Notification' in window &&
                         'fetch' in window;

  // iOS 16.4+ supports Web Push, but OneSignal is still more reliable
  const iosVersion = isIOS ? parseFloat(userAgent.match(/os ([0-9_]+)/)?.[1]?.replace(/_/g, '.') || '0') : 0;
  const supportsIOSWebPush = isIOS && iosVersion >= 16.4;
  
  // Routing logic: prefer OneSignal for iOS/macOS Safari, Web Push for others
  const needsOneSignal = (isIOS && !supportsIOSWebPush) || 
                        (isMacOS && browser === 'safari') ||
                        !supportsWebPush;

  let platform: 'ios' | 'android' | 'macos' | 'windows' | 'linux' | 'unknown';
  if (isIOS) platform = 'ios';
  else if (isAndroid) platform = 'android';
  else if (isMacOS) platform = 'macos';
  else if (isWindows) platform = 'windows';
  else if (isLinux) platform = 'linux';
  else platform = 'unknown';

  return {
    isIOS,
    isAndroid,
    isMacOS,
    isWindows,
    isLinux,
    isMobile,
    isDesktop,
    isStandalone,
    isPWA,
    needsOneSignal,
    supportsWebPush,
    platform,
    browser,
    version
  };
}





