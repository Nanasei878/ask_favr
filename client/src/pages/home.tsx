import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, User, Search, Plus, Home, Compass, Bell, MessageCircle, Car, Dog, Wrench, Package, Settings, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import FavorCard from "@/components/favor-card";
import FavorDetailModal from "@/components/favor-detail-modal";
import PostFavorModal from "@/components/post-favor-modal";
import MessagesCenter from "@/components/messages-center";
import UserProfile from "@/components/user-profile-complete";
import { FavorCardSkeleton, CategorySkeleton } from "@/components/ui/skeleton";
import { FloatingActionButton } from "@/components/micro-interactions";
import { useAccessibility, AccessibleNav } from "@/components/accessibility-provider";
import { useLocation } from "@/hooks/use-location";
import { useLocation as useRouterLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useGlobalChat } from "@/hooks/use-global-chat";
import { trackEvent } from "@/lib/analytics";
import { notificationService } from "@/lib/notifications";


import type { Favor } from "@shared/schema";

export default function HomePage() {
  const [selectedFavor, setSelectedFavor] = useState<Favor | null>(null);
  const [showFavorDetail, setShowFavorDetail] = useState(false);
  const [showPostFavor, setShowPostFavor] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [smartFavorData, setSmartFavorData] = useState<any>(null);
  const { location, loading: locationLoading } = useLocation();
  const [, setLocation] = useRouterLocation();
  const { toast } = useToast();
  const { announce } = useAccessibility();
  const { user } = useAuth();
  
  // Enable global chat for real-time unread message count updates
  useGlobalChat();

  // No longer redirect to onboarding - demographic data collection moved to profile notifications

  const { data: favors = [], isLoading } = useQuery<Favor[]>({
    queryKey: ["/api/favors"],
  });

  // Fetch unread message count for the message icon badge
  const { data: userConversations } = useQuery({
    queryKey: ["/api/chat/conversations"],
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds (real-time updates via WebSocket)
  });

  const unreadMessageCount = userConversations && Array.isArray(userConversations) 
    ? userConversations.reduce((sum: number, conversation: any) => sum + (conversation.unreadCount || 0), 0)
    : 0;

  // Debug location data
  useEffect(() => {
    console.log('Location data updated:', { location, loading: locationLoading });
    if (location && favors.length > 0) {
      console.log('User location:', [location.latitude, location.longitude], location.address);
      console.log('Available favors:', favors.map(f => ({ 
        title: f.title, 
        coords: [parseFloat(f.latitude), parseFloat(f.longitude)],
        address: f.address 
      })));
    }
  }, [location, locationLoading, favors]);

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Radius of Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Filter nearby favors (within 15km of user location)
  const nearbyFavors = favors.filter(favor => {
    if (!location) return true; // Show all if no location
    
    const favorLat = parseFloat(favor.latitude);
    const favorLng = parseFloat(favor.longitude);
    const distance = calculateDistance(location.latitude, location.longitude, favorLat, favorLng);
    console.log(`Distance to favor "${favor.title}": ${distance.toFixed(2)}km from ${location.address}`, { 
      userLoc: [location.latitude, location.longitude],
      favorLoc: [favorLat, favorLng]
    });
    return distance <= 15; // 15km radius for Luxembourg region
  });

  // Active favors are ones the current user posted (empty for now since no user system)
  const activeFavors: Favor[] = [];

  const handleFavorClick = (favor: Favor) => {
    setSelectedFavor(favor);
    setShowFavorDetail(true);
  };

  const handleQuickAction = (action: string, category: string) => {
    setShowPostFavor(true);
  };

  const quickActions = [
    { label: "Need a Ride", icon: Car, category: "Ride", color: "bg-blue-500" },
    { label: "Walk my Dog", icon: Dog, category: "Pet Care", color: "bg-green-500" },
    { label: "Handyman", icon: Wrench, category: "Handyman", color: "bg-orange-500" },
    { label: "Delivery", icon: Package, category: "Delivery", color: "bg-purple-500" },
    { label: "Moving", icon: Truck, category: "Moving", color: "bg-red-500" },
    { label: "Others", icon: Settings, category: "Others", color: "bg-purple-500" },
  ];

  const Header = () => {
    return (
      <header className="px-4 sm:px-6 lg:px-8 py-4 bg-gradient-to-r from-slate-800 to-slate-700 border-b border-slate-600">
        <div className="container-responsive">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-favr-blue rounded-full flex items-center justify-center shadow-lg border-2 border-favr-blue/30 flex-shrink-0">
                <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs sm:text-sm font-medium text-white truncate">
                  {locationLoading ? "Getting your location..." : location?.address || "Location not available"}
                </div>
                <div className="text-xs text-slate-300 hidden sm:block">Current location</div>
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
              {user ? (
                <>
                  <div className="text-right hidden sm:block">
                    <div className="text-sm font-medium text-white">Hi, {user.firstName}!</div>
                    <div className="text-xs text-slate-300">Welcome back</div>
                  </div>
                  <Button 
                    variant="ghost"
                    size="icon"
                    onClick={() => setLocation(`/user/${user.id}`)}
                    className="w-8 h-8 sm:w-10 sm:h-10 bg-favr-blue rounded-full flex items-center justify-center text-white hover:bg-blue-600 flex-shrink-0"
                  >
                    <span className="text-xs sm:text-sm font-bold">
                      {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                    </span>
                  </Button>
                </>
              ) : (
                <Button 
                  onClick={() => setLocation("/auth")}
                  className="bg-favr-blue hover:bg-blue-600 text-white px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>
    );
  };

  const HeroSection = () => (
    <section className="relative px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 overflow-hidden">
      {/* Futuristic Connection Grid Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Grid lines */}
        <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 400 300">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(59, 130, 246, 0.3)" strokeWidth="0.5"/>
            </pattern>
            <radialGradient id="neonGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(59, 130, 246, 0.8)" />
              <stop offset="50%" stopColor="rgba(59, 130, 246, 0.4)" />
              <stop offset="100%" stopColor="rgba(59, 130, 246, 0.1)" />
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Glowing connection nodes */}
        <div className="absolute top-16 left-16 w-3 h-3 bg-blue-400 rounded-full shadow-lg shadow-blue-400/50 animate-pulse"></div>
        <div className="absolute top-24 right-20 w-2 h-2 bg-cyan-400 rounded-full shadow-lg shadow-cyan-400/50 animate-pulse delay-300"></div>
        <div className="absolute bottom-20 left-1/3 w-4 h-4 bg-blue-300 rounded-full shadow-lg shadow-blue-300/50 animate-pulse delay-700"></div>
        <div className="absolute top-32 left-1/2 w-2 h-2 bg-indigo-400 rounded-full shadow-lg shadow-indigo-400/50 animate-pulse delay-1000"></div>
        <div className="absolute bottom-32 right-16 w-3 h-3 bg-blue-500 rounded-full shadow-lg shadow-blue-500/50 animate-pulse delay-1500"></div>

        {/* Dynamic connection lines */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 300">
          <defs>
            <linearGradient id="neonLine" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(59, 130, 246, 0.8)" />
              <stop offset="50%" stopColor="rgba(147, 197, 253, 0.6)" />
              <stop offset="100%" stopColor="rgba(59, 130, 246, 0.2)" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          <path 
            d="M64,64 Q200,50 336,96" 
            stroke="url(#neonLine)" 
            strokeWidth="1.5" 
            fill="none"
            filter="url(#glow)"
            className="animate-pulse"
          />
          <path 
            d="M80,144 Q200,130 320,176" 
            stroke="url(#neonLine)" 
            strokeWidth="1" 
            fill="none"
            filter="url(#glow)"
            className="animate-pulse delay-700"
          />
          <path 
            d="M200,50 L160,128" 
            stroke="url(#neonLine)" 
            strokeWidth="0.8" 
            fill="none"
            filter="url(#glow)"
            className="animate-pulse delay-1200"
          />
        </svg>

        {/* Floating light particles */}
        <div className="absolute top-20 right-24 w-1 h-1 bg-blue-400 rounded-full animate-ping"></div>
        <div className="absolute bottom-24 left-20 w-1 h-1 bg-cyan-300 rounded-full animate-ping delay-500"></div>
        <div className="absolute top-40 left-1/2 w-1 h-1 bg-blue-300 rounded-full animate-ping delay-1000"></div>
        
        {/* Overlay gradients for depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 via-transparent to-indigo-900/20"></div>
      </div>
      
      <div className="relative text-center z-10 container-responsive">
        {/* Logo with glow effect */}
        <div className="flex justify-center mb-4 sm:mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-white/20 rounded-full blur-xl scale-110"></div>
            <img 
              src="/attached_assets/A6E6772A-1A83-435C-9131-8C494656D116_1750518078054.PNG"
              alt="Favr Logo" 
              className="relative w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 object-contain drop-shadow-2xl"
            />
          </div>
        </div>
        
        <p className="text-white/90 text-base sm:text-lg lg:text-xl mb-6 sm:mb-8 drop-shadow-md px-4">Connect with people nearby</p>
        
        {/* Quick stats */}
        <div className="flex justify-center space-x-4 sm:space-x-6 lg:space-x-8 mt-4 sm:mt-6 text-white/80">
          <div className="text-center cursor-pointer" onClick={() => toast({
            title: "Rating System",
            description: "Coming soon! We're building an amazing rating system for our community.",
            duration: 3000,
          })}>
            <div className="text-lg font-bold">⭐</div>
            <div className="text-xs">Rating</div>
          </div>
          <div className="text-center cursor-pointer" onClick={() => toast({
            title: "Favr Points System",
            description: "Coming soon! Earn points by helping others and unlock rewards.",
            duration: 3000,
          })}>
            <div className="w-6 h-6 bg-favr-blue rounded-full flex items-center justify-center mx-auto mb-1">
              <span className="text-white text-xs font-bold">F</span>
            </div>
            <div className="text-xs">Favr Points</div>
          </div>
        </div>
      </div>
    </section>
  );

  const QuickActions = () => (
    <section className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 bg-slate-900">
      <div className="container-responsive">
        <h2 className="text-lg sm:text-xl font-semibold text-white mb-4 sm:mb-6">What do you need help with?</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Button
                key={index}
                variant="outline"
                onClick={() => handleQuickAction(action.label, action.category)}
                className="flex flex-col items-center p-3 sm:p-4 lg:p-6 h-auto bg-slate-800/50 border-slate-700 hover:border-favr-blue hover:bg-slate-800 rounded-xl backdrop-blur-sm transition-all duration-200"
              >
                <div className={`w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 ${action.color} rounded-xl flex items-center justify-center mb-2 sm:mb-3 shadow-lg`}>
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-white" />
                </div>
                <span className="text-xs sm:text-sm text-center font-medium text-white leading-tight">{action.label}</span>
              </Button>
            );
          })}
        </div>
      </div>
    </section>
  );

  const BottomNavigation = () => (
    <nav className="fixed bottom-0 left-0 right-0 w-full bg-slate-800/95 backdrop-blur-lg border-t border-slate-700 px-2 sm:px-4 py-2 z-50 safe-area-inset-bottom">
      <div className="flex items-center justify-around max-w-sm sm:max-w-md mx-auto">
        <Button variant="ghost" className="flex flex-col items-center space-y-1 text-favr-blue p-2">
          <Home className="w-5 h-5" />
          <span className="text-xs font-medium">Home</span>
        </Button>
        <Button 
          variant="ghost" 
          onClick={() => {
            trackEvent('navigation_click', 'navigation', 'explore');
            setLocation('/explore');
          }}
          className="flex flex-col items-center space-y-1 text-slate-400 hover:text-white p-2"
        >
          <Compass className="w-5 h-5" />
          <span className="text-xs font-medium">Explore</span>
        </Button>
        <div className="flex flex-col items-center">
          <Button 
            onClick={() => {
              trackEvent('post_favor_click', 'engagement', 'floating_button');
              setSmartFavorData(null);
              setShowPostFavor(true);
            }}
            className="w-12 h-12 bg-gradient-to-r from-favr-blue to-blue-600 rounded-full flex items-center justify-center -mt-2 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
          >
            <Plus className="w-5 h-5 text-white" />
          </Button>
          <span className="text-xs font-medium text-slate-400 mt-1">Ask a Favr</span>
        </div>
        <Button 
          variant="ghost" 
          onClick={() => {
            trackEvent('navigation_click', 'navigation', 'messages');
            if (!user) {
              toast({
                title: "Sign in required",
                description: "Please sign in to view your messages.",
                variant: "destructive",
              });
              setLocation('/auth');
              return;
            }
            setShowNotificationSettings(true);
          }}
          className="flex flex-col items-center space-y-1 text-slate-400 hover:text-white p-2 relative"
        >
          <div className="relative">
            <MessageCircle className="w-5 h-5" />
            {user && unreadMessageCount > 0 && (
              <Badge 
                variant="secondary" 
                className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[18px] h-[18px] flex items-center justify-center"
              >
                {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
              </Badge>
            )}
          </div>
          <span className="text-xs font-medium">Messages</span>
        </Button>
        <Button 
          variant="ghost" 
          onClick={() => {
            if (!user) {
              toast({
                title: "Sign in required",
                description: "Please sign in to view your profile.",
                variant: "destructive",
              });
              setLocation('/auth');
              return;
            }
            setShowUserProfile(true);
          }}
          className="flex flex-col items-center space-y-1 text-slate-400 hover:text-white p-2"
        >
          <User className="w-5 h-5" />
          <span className="text-xs font-medium">Profile</span>
        </Button>
      </div>
    </nav>
  );

  if (isLoading) {
    return (
      <div className="w-full bg-slate-900 min-h-screen">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-favr-blue mx-auto mb-4"></div>
            <p className="text-slate-400">Loading favors...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-slate-900 min-h-screen relative">
      <Header />
      <HeroSection />
      <QuickActions />
      
      <main className="flex-1 pb-16 sm:pb-20">
        {/* Favrs Nearby Section */}
        <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 bg-slate-900">
          <div className="container-responsive">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-semibold text-white">Favrs Nearby</h2>
              <Button 
                variant="ghost" 
                className="text-favr-blue text-sm font-medium p-0 h-auto hover:text-blue-400"
                onClick={() => setLocation('/explore')}
              >
                View All
              </Button>
            </div>
            
            <div className="space-y-3 sm:space-y-4">
            {nearbyFavors.map((favor) => (
              <FavorCard 
                key={favor.id} 
                favor={favor} 
                onClick={() => handleFavorClick(favor)}
              />
            ))}
          </div>
          
          {nearbyFavors.length === 0 && (
            <div className="text-center py-6 sm:py-8 bg-slate-800/50 rounded-xl border border-slate-700">
              <div className="flex justify-center mb-4">
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="40" cy="40" r="35" fill="#1e293b" stroke="#334155" strokeWidth="2"/>
                  <path d="M40 25 L55 40 L40 55 L25 40 Z" fill="#475569"/>
                  <circle cx="40" cy="40" r="3" fill="#64748b"/>
                  <path d="M40 15 Q45 20 40 25 Q35 20 40 15" fill="#475569"/>
                </svg>
              </div>
              <p className="text-slate-400 font-medium">No favrs nearby</p>
              <p className="text-slate-500 text-sm mt-1">
                {location ? `Searching within 25km of ${location.address}` : "Enable location to find nearby favrs"}
              </p>
              <p className="text-xs text-slate-600 mt-2">
                Total favrs available: {favors.length} • Location: {location ? '✓' : '✗'}
              </p>
            </div>
          )}
          </div>
        </div>
        

      </main>

      <BottomNavigation />

      {showFavorDetail && selectedFavor && (
        <FavorDetailModal
          favor={selectedFavor}
          isOpen={showFavorDetail}
          onClose={() => setShowFavorDetail(false)}
        />
      )}

      {showPostFavor && (
        <PostFavorModal
          isOpen={showPostFavor}
          onClose={() => {
            setShowPostFavor(false);
            setSmartFavorData(null);
          }}
          smartData={smartFavorData}
        />
      )}

      {showNotificationSettings && (
        <MessagesCenter
          isOpen={showNotificationSettings}
          onClose={() => setShowNotificationSettings(false)}
        />
      )}

      {showUserProfile && (
        <UserProfile
          isOpen={showUserProfile}
          onClose={() => setShowUserProfile(false)}
        />
      )}
    </div>
  );
}
