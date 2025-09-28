import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { getPrivateAddress } from "@shared/locationUtils";
import { ArrowLeft, Star, MapPin, Clock, Calendar, Shield, Award, MessageCircle, Info, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import FavorCard from "@/components/favor-card";
import FavorDetailModal from "@/components/favor-detail-modal";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";

import type { User, FavorWithPoster } from "@shared/schema";

export default function UserProfile() {
  const { userId } = useParams();
  const [, setLocation] = useLocation();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [selectedFavor, setSelectedFavor] = useState<FavorWithPoster | null>(null);
  const [showFavorDetail, setShowFavorDetail] = useState(false);


  const { data: profileUser, isLoading: userLoading } = useQuery<User>({
    queryKey: [`/api/users/${userId}`],
    enabled: !!userId,
  });

  const { data: userFavors = [], isLoading: favorsLoading } = useQuery<FavorWithPoster[]>({
    queryKey: [`/api/users/${userId}/favors`],
    enabled: !!userId,
  });

  const { data: completedFavors = [] } = useQuery<FavorWithPoster[]>({
    queryKey: [`/api/users/${userId}/completed-favors`],
    enabled: !!userId,
  });

  const isOwnProfile = currentUser?.id?.toString() === userId;



  if (userLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-favr-blue border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">User Not Found</h1>
          <Button onClick={() => setLocation('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  const activeFavors = userFavors.filter(favor => favor.status === 'open');
  const totalRating = 4.8; // Placeholder for rating system
  const totalReviews = 24; // Placeholder for review count
  const joinDate = new Date(profileUser.memberSince || '2024-01-01');

  const handleStartChat = () => {
    if (!currentUser) {
      toast({
        title: "Sign in required",
        description: "Please sign in to message this user.",
        variant: "destructive",
      });
      setLocation('/auth');
      return;
    }
    
    trackEvent('user_profile_message', 'engagement', 'profile_view');
    // Find an active favor from this user to start chat
    const activeFavor = activeFavors[0];
    if (activeFavor) {
      setLocation(`/chat/${activeFavor.id}`);
    } else {
      toast({
        title: "No active favors",
        description: "This user doesn't have any active favors to chat about.",
      });
    }
  };

  const handleFavorClick = (favor: FavorWithPoster) => {
    trackEvent('user_profile_favor_click', 'engagement', favor.category, favor.id);
    // Create a privacy-aware version of the favor for the modal
    const privacyAwareFavor = {
      ...favor,
      address: isOwnProfile ? favor.address : getPrivateAddress(favor.address)
    };
    setSelectedFavor(privacyAwareFavor);
    setShowFavorDetail(true);
  };



  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="sticky top-0 bg-slate-800/95 backdrop-blur-lg border-b border-slate-700 px-4 py-3 z-40">
        <div className="flex items-center space-x-3">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => {
              trackEvent('navigation_click', 'navigation', 'back_from_profile');
              setLocation('/');
            }}
            className="text-favr-blue hover:bg-slate-700"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">
              {profileUser.firstName} {profileUser.lastName?.charAt(0) || ""}.
            </h1>
            <p className="text-sm text-slate-400">User Profile</p>
          </div>
        </div>
      </header>

      {/* Demographic Information Notification */}
      {isOwnProfile && (!profileUser.dateOfBirth || !profileUser.country) && (
        <div className="mx-4 mt-4 bg-blue-600/20 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Info className="w-5 h-5 text-blue-400 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-white font-medium mb-1">Complete Your Profile</h3>
              <p className="text-blue-100 text-sm mb-3">
                Help us understand our community better by sharing your age and location.
              </p>
              <Button 
                onClick={() => setLocation('/onboarding')}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 h-auto"
              >
                Complete Now
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 py-6 space-y-6">
        {/* Profile Header */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <div className="flex items-start space-x-4">
            <div className="w-20 h-20 bg-favr-blue rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {profileUser.firstName?.charAt(0) || "U"}{profileUser.lastName?.charAt(0) || ""}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-1">
                {profileUser.firstName} {profileUser.lastName?.charAt(0) || ""}.
              </h2>
              <div className="flex items-center space-x-4 text-sm text-slate-400 mb-3">
                <div className="flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span>Joined {joinDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                </div>
                {profileUser.country && (
                  <div className="flex items-center space-x-1">
                    <MapPin className="w-4 h-4" />
                    <span>{profileUser.country}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-4 mb-4">
                <div className="flex items-center space-x-1">
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                  <span className="font-medium">{parseFloat(profileUser.averageRating || "0").toFixed(1)}</span>
                  <span className="text-slate-400">({profileUser.totalRatings || 0} reviews)</span>
                </div>
                <Badge variant="outline" className="border-green-500 text-green-400">
                  <Shield className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
              </div>
              {!isOwnProfile ? (
                <Button 
                  onClick={handleStartChat}
                  className="bg-favr-blue hover:bg-blue-600 text-white"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Message
                </Button>
              ) : (
                <Button 
                  onClick={() => setLocation('/settings')}
                  className="w-full bg-favr-blue hover:bg-blue-600 text-white"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-800/50 rounded-xl p-4 text-center border border-slate-700">
            <div className="text-2xl font-bold text-favr-blue">{activeFavors.length}</div>
            <div className="text-sm text-slate-400">Active Favors</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 text-center border border-slate-700">
            <div className="text-2xl font-bold text-green-400">{profileUser.completedFavrs || 0}</div>
            <div className="text-sm text-slate-400">Completed</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 text-center border border-slate-700">
            <div className="text-2xl font-bold text-yellow-400">★ {parseFloat(profileUser.averageRating || "0").toFixed(1)}</div>
            <div className="text-sm text-slate-400">Rating</div>
          </div>
        </div>

        {/* Active Favors */}
        {activeFavors.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Active Favors</h3>
              <Badge variant="outline" className="border-favr-blue text-favr-blue">
                {activeFavors.length} active
              </Badge>
            </div>
            <div className="space-y-3">
              {favorsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-6 h-6 border-4 border-favr-blue border-t-transparent rounded-full mx-auto"></div>
                </div>
              ) : (
                activeFavors.map((favor) => (
                  <FavorCard
                    key={favor.id}
                    favor={favor}
                    onClick={() => handleFavorClick(favor)}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* Recent Activity / Reviews Placeholder */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold mb-4">Recent Reviews</h3>
          <div className="space-y-4">
            <div className="text-center py-8 text-slate-400">
              <Award className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Reviews and rating system coming soon!</p>
              <p className="text-sm mt-1">Build trust in your community with verified reviews.</p>
            </div>
          </div>
        </div>

        {/* Contact Safety Notice */}
        {!isOwnProfile && (
          <div className="bg-yellow-900/20 border border-yellow-700 rounded-xl p-4">
            <div className="flex items-start space-x-3">
              <Shield className="w-5 h-5 text-yellow-400 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-200 mb-1">Safety First</p>
                <p className="text-yellow-300/80">
                  Always meet in public places and trust your instincts. 
                  Report any suspicious behavior to keep our community safe.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Favor Detail Modal */}
      {selectedFavor && (
        <FavorDetailModal
          favor={selectedFavor}
          isOpen={showFavorDetail}
          onClose={() => {
            setShowFavorDetail(false);
            setSelectedFavor(null);
          }}
        />
      )}
    </div>
  );
}