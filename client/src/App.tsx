// App.tsx
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  AccessibilityProvider,
  SkipLink,
} from "@/components/accessibility-provider";
import { useAuth } from "@/hooks/use-auth";
import { useLocationNotifications } from "@/hooks/useLocationNotifications";
import { Info, X } from "lucide-react";
import { useEffect, useState } from "react";
import { initGA } from "./lib/analytics";
import { useAnalytics } from "./hooks/use-analytics";

// Pages
import Home from "@/pages/home";
import Explore from "@/pages/explore";
import Chat from "@/pages/chat";
import Landing from "@/pages/landing";
import UserProfile from "@/pages/user-profile";
import HowItWorks from "@/pages/how-it-works";
import NotFound from "@/pages/not-found";
import OnboardingPage from "@/pages/onboarding";
import FavorDetail from "@/pages/favor-detail";
import EditProfile from "@/pages/edit-profile";

// UI
import PWAInstallPrompt from "@/components/pwa-install-prompt";
import NotificationPrompt from "@/components/notification-prompt";

// 🔔 Unified notifications (frontend)
import {
  unifiedNotificationService,
  subscribeToNotifications,
} from "./lib/unifiedNotifications";

function BetaBanner() {
  const [isVisible, setIsVisible] = useState(true);
  if (!isVisible) return null;

  return (
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 text-center relative z-50">
      <div className="flex items-center justify-center space-x-2 text-sm">
        <Info className="w-4 h-4" />
        <span>
          <strong>Beta Version:</strong> Welcome to Favr! We're in beta testing
          phase. Report any issues and help us improve your community
          experience.
        </span>
        <button
          onClick={() => setIsVisible(false)}
          className="ml-2 p-1 hover:bg-white/20 rounded transition-colors"
          aria-label="Dismiss beta notice"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function Router() {
  // Track page views when routes change
  useAnalytics();

  return (
    <main id="main-content" role="main">
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/explore" component={Explore} />
        <Route path="/auth" component={Landing} />
        <Route path="/how-it-works" component={HowItWorks} />
        <Route path="/chat/:favorId" component={Chat} />
        <Route path="/negotiate/:favorId" component={Chat} />
        <Route path="/user/:userId" component={UserProfile} />
        <Route path="/favor/:favorId" component={FavorDetail} />
        <Route path="/onboarding" component={OnboardingPage} />
        <Route path="/edit-profile" component={EditProfile} />
        <Route component={NotFound} />
      </Switch>
    </main>
  );
}

function App() {
  const { user } = useAuth();

  // Real-time favor alerts based on location
  useLocationNotifications();

  // Listen for Service Worker messages (notification clicks, etc.)
  useEffect(() => {
  const onSWMessage = (event: MessageEvent) => {
    const t = event.data?.type;
    if ((t === "NOTIFICATION_CLICK" || t === "NOTIFICATION_CLICKED") && event.data?.url) {
      window.location.href = event.data.url;
    }
  };
  navigator.serviceWorker?.addEventListener("message", onSWMessage);
  return () => navigator.serviceWorker?.removeEventListener("message", onSWMessage);
}, []);

  // Initialize GA + unified notifications bootstrap
  useEffect(() => {
    // Notifications bootstrap (does not force a prompt)
    (async () => {
      await unifiedNotificationService.initialize();

      // If user is already logged in and OS permission is granted,
      // make sure we’re registered server-side (silent happy-path).
      if (user?.id) {
        try {
          const isSub = await unifiedNotificationService.isSubscribed();
          const permGranted =
            typeof Notification !== "undefined" &&
            Notification.permission === "granted";

          // For OneSignal path, isSubscribed() already checks via SDK.
          if (!isSub && permGranted) {
            await subscribeToNotifications(String(user.id));
          }
        } catch (e) {
          // non-fatal
          console.warn("Silent subscription check failed:", e);
        }
      }
    })();

    // Analytics
    if (!import.meta.env.VITE_GA_MEASUREMENT_ID) {
      console.warn(
        "Missing required Google Analytics key: VITE_GA_MEASUREMENT_ID"
      );
    } else {
      initGA();
    }
  }, [user?.id]);

  return (
    <AccessibilityProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <div className="min-h-screen w-full bg-slate-900 m-0 p-0" lang="en">
            <SkipLink />
            <BetaBanner />
            <Router />
            <PWAInstallPrompt />
            {/* This component can invoke requestPermission()/subscribe based on UX */}
            <NotificationPrompt />
            <Toaster />
          </div>
        </TooltipProvider>
      </QueryClientProvider>
    </AccessibilityProvider>
  );
}

export default App;
