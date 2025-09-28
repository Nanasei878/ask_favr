import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, List, Map, Plus, Search, MessageCircle, User, Home, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import FavorCard from "@/components/favor-card";
import MapView from "@/components/map-view-fixed";
import CategoryFilters from "@/components/category-filters";
import FavorDetailModal from "@/components/favor-detail-modal";
import PostFavorModal from "@/components/post-favor-modal";
import MessagesCenter from "@/components/messages-center";
import UserProfile from "@/components/user-profile-complete";
import type { Favor } from "@shared/schema";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useGlobalChat } from "@/hooks/use-global-chat";
import { useToast } from "@/hooks/use-toast";

export default function ExplorePage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Enable global chat for real-time unread message count updates
  useGlobalChat();
  const [selectedFavor, setSelectedFavor] = useState<Favor | null>(null);
  const [showFavorDetail, setShowFavorDetail] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showPostFavor, setShowPostFavor] = useState(false);
  const [showMessagesCenter, setShowMessagesCenter] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  
  // Check if this is from a notification (new=true parameter)
  const urlParams = new URLSearchParams(window.location.search);
  const isFromNotification = urlParams.get('new') === 'true';

  // Show message when arriving from notification
  useEffect(() => {
    if (isFromNotification) {
      toast({
        title: "New Favors Available!",
        description: "Here are the latest favors in your area",
        duration: 4000,
      });
      // Clean up URL after showing message
      window.history.replaceState({}, '', '/explore');
    }
  }, [isFromNotification, toast]);

  // Test direct API connection
  useEffect(() => {
    const testAPI = async () => {
      try {
        console.log('Testing direct API connection...');
        const response = await fetch('/api/favors');
        console.log('Direct fetch response:', {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          url: response.url
        });
        if (response.ok) {
          const data = await response.json();
          console.log('Direct fetch data:', data);
        } else {
          console.error('Direct fetch failed:', await response.text());
        }
      } catch (error) {
        console.error('Direct fetch error:', error);
      }
    };
    testAPI();
  }, []);

  const { data: favors = [], isLoading, error, isError } = useQuery<Favor[]>({
    queryKey: ["/api/favors"],
    retry: 1,
    retryDelay: 500,
    staleTime: 30000,
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

  console.log('Query state:', { isLoading, isError, hasData: !!favors.length, error: error?.message });

  const filteredFavors = favors.filter(favor => 
    selectedCategory === 'All' || favor.category === selectedCategory
  );

  const handleFavorClick = (favor: Favor) => {
    setSelectedFavor(favor);
    setShowFavorDetail(true);
  };

  const BottomNavigation = () => (
    <nav className="fixed bottom-0 left-0 right-0 w-full bg-slate-800/95 backdrop-blur-lg border-t border-slate-700 px-2 sm:px-4 py-2 z-50 safe-area-inset-bottom">
      <div className="flex items-center justify-around max-w-sm sm:max-w-md mx-auto">
        <Button 
          variant="ghost" 
          onClick={() => setLocation('/')}
          className="flex flex-col items-center space-y-1 text-slate-400 hover:text-white p-2"
        >
          <Home className="w-5 h-5" />
          <span className="text-xs font-medium">Home</span>
        </Button>
        <Button variant="ghost" className="flex flex-col items-center space-y-1 text-favr-blue p-2">
          <Compass className="w-5 h-5" />
          <span className="text-xs font-medium">Explore</span>
        </Button>
        <div className="flex flex-col items-center">
          <Button 
            onClick={() => setShowPostFavor(true)}
            className="w-12 h-12 bg-gradient-to-r from-favr-blue to-blue-600 rounded-full flex items-center justify-center -mt-2 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
          >
            <Plus className="w-5 h-5 text-white" />
          </Button>
          <span className="text-xs font-medium text-slate-400 mt-1">Ask a Favr</span>
        </div>
        <Button 
          variant="ghost" 
          onClick={() => {
            if (!user) {
              toast({
                title: "Sign in required",
                description: "Please sign in to view your messages.",
                variant: "destructive",
              });
              setLocation('/auth');
              return;
            }
            setShowMessagesCenter(true);
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

  if (error) {
    return (
      <div className="max-w-md mx-auto bg-slate-900 min-h-screen">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-red-400 mb-4">Error loading favors</p>
            <p className="text-slate-400 text-sm">{error.message}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-favr-blue text-white rounded hover:bg-blue-600"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

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
    <div className="w-full bg-slate-900 min-h-screen">
      {/* Header */}
      <header className="sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10 border-b border-slate-700 px-4 sm:px-6 lg:px-8 py-3">
        <div className="container-responsive">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setLocation('/')}
                className="text-slate-400 hover:text-white flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
              <h1 className="text-lg sm:text-xl font-bold text-white truncate">Explore Favrs</h1>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => {
                if (!user) {
                  toast({
                    title: "Sign in required",
                    description: "Please sign in to view your messages.",
                    variant: "destructive",
                  });
                  setLocation('/auth');
                  return;
                }
                setShowMessagesCenter(true);
              }}
              className="text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <MessageCircle className="w-5 h-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
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
              className="text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <User className="w-5 h-5" />
            </Button>
            </div>
          </div>
        </div>
      </header>

      {/* View Toggle & Filters */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 bg-slate-900 border-b border-slate-700">
        <div className="container-responsive">
          <div className="flex justify-center mb-4">
            <div className="flex bg-slate-800 p-1 rounded-lg">
              <Button
                onClick={() => setViewMode('list')}
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                className={viewMode === 'list' ? 'bg-favr-blue text-white shadow-sm' : 'text-slate-400 hover:text-white'}
              >
                <List className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="text-xs sm:text-sm">List</span>
              </Button>
              <Button
                onClick={() => setViewMode('map')}
                variant={viewMode === 'map' ? 'default' : 'ghost'}
                size="sm"
                className={viewMode === 'map' ? 'bg-favr-blue text-white shadow-sm' : 'text-slate-400 hover:text-white'}
              >
                <Map className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="text-xs sm:text-sm">Map</span>
              </Button>
            </div>
          </div>

          <CategoryFilters 
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            availableCategories={Array.from(new Set(favors.map(f => f.category)))}
          />
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 bg-slate-900 pb-16 sm:pb-20">
        {viewMode === 'list' ? (
          <div className="px-4 sm:px-6 lg:px-8 pb-4 sm:pb-6">
            <div className="container-responsive">
              <div className="space-y-3 sm:space-y-4">
              {filteredFavors.map((favor) => (
                <FavorCard 
                  key={favor.id} 
                  favor={favor} 
                  onClick={() => handleFavorClick(favor)}
                />
              ))}
            </div>
            
            {filteredFavors.length === 0 && (
              <div className="text-center py-12 sm:py-16">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Plus className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">No Favrs found</h3>
                <p className="text-slate-400 mb-4 text-sm sm:text-base">Be the first to post a Favr in your area</p>
                <Button 
                  onClick={() => {
                    if (!user) {
                      toast({
                        title: "Sign in required",
                        description: "Please sign in to post a favor",
                        variant: "destructive",
                      });
                      setLocation('/auth');
                      return;
                    }
                    setShowPostFavor(true);
                  }}
                  className="bg-favr-blue text-white hover:bg-blue-600"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Post Favr
                </Button>
              </div>
            )}
            </div>
          </div>
        ) : (
          <div className="h-[calc(100vh-220px)] w-full">
            <MapView 
              favors={filteredFavors} 
              onFavorClick={handleFavorClick}
            />
          </div>
        )}
      </main>

      <BottomNavigation />

      {/* Modals */}
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
          onClose={() => setShowPostFavor(false)}
        />
      )}

      {showMessagesCenter && (
        <MessagesCenter
          isOpen={showMessagesCenter}
          onClose={() => setShowMessagesCenter(false)}
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