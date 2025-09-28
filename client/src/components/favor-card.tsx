import { MapPin, Star, Clock, User } from "lucide-react";
import { LikeButton, BookmarkButton, InteractiveCard } from "./micro-interactions";
import { calculateFavorExpiration, getUrgencyColor } from "@/lib/favorExpiration";
import { getPrivateAddress } from "@shared/locationUtils";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { trackEvent } from "@/lib/analytics";
import type { FavorWithPoster } from "@shared/schema";

interface FavorCardProps {
  favor: FavorWithPoster;
  onClick: () => void;
}

export default function FavorCard({ favor, onClick }: FavorCardProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const expirationInfo = calculateFavorExpiration(
    typeof favor.createdAt === 'string' ? favor.createdAt : favor.createdAt?.toISOString() || new Date().toISOString(), 
    favor.timeframe
  );
  const urgencyColor = getUrgencyColor(expirationInfo.urgencyLevel);

  // Determine if current user is the owner of this favor
  const isOwner = user?.id?.toString() === favor.posterId?.toString();
  
  // Get appropriate address based on ownership
  const displayAddress = isOwner ? favor.address : getPrivateAddress(favor.address);
  
  const getAreaName = (address: string) => {
    if (!address) return "Nearby";
    return address;
  };

  const handleCardClick = () => {
    // Track favor card clicks
    trackEvent('favor_card_click', 'engagement', favor.category, favor.id);
    onClick();
  };

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <InteractiveCard
      onClick={handleCardClick}
      className="favor-card bg-slate-800 border border-slate-700 rounded-xl p-3 sm:p-4 relative group shadow-lg hover:shadow-xl hover:border-slate-600 transition-all duration-200"
    >
      {/* Quick action buttons */}
      <div className="absolute top-2 right-2 sm:top-3 sm:right-3 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div className="action-button" onClick={handleActionClick}>
          <LikeButton 
            favorId={favor.id} 
            initialLiked={false}
            likeCount={Math.floor(Math.random() * 20)}
            onLike={(id, liked) => console.log(`Favor ${id} ${liked ? 'liked' : 'unliked'}`)}
          />
        </div>
        <div className="action-button" onClick={handleActionClick}>
          <BookmarkButton 
            favorId={favor.id}
            initialBookmarked={false}
            onBookmark={(id, bookmarked) => console.log(`Favor ${id} ${bookmarked ? 'bookmarked' : 'unbookmarked'}`)}
          />
        </div>
      </div>

      <div className="flex space-x-2 sm:space-x-3">
        {favor.imageUrl ? (
          <img 
            src={favor.imageUrl}
            alt={`${favor.title} - ${favor.category} favor`}
            className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
            <User className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-white mb-1 truncate text-sm sm:text-base">
            {favor.title}
          </h3>
          <div className="flex items-center text-xs sm:text-sm text-slate-400 mb-2 space-x-1 sm:space-x-2">
            <div className="flex items-center space-x-1">
              <Clock className="w-3 h-3 flex-shrink-0" />
              <span className={`truncate ${expirationInfo.isExpired ? 'text-red-400 line-through' : ''}`}>
                {expirationInfo.isExpired ? 'Expired' : favor.timeframe}
              </span>
            </div>
            <span className="hidden sm:inline">•</span>
            <div className="flex items-center space-x-1 min-w-0 flex-1">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{getAreaName(displayAddress)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-favr-blue font-semibold text-sm sm:text-base">
              €{favor.price}
              {favor.isNegotiable && <span className="text-xs text-slate-400 ml-1 hidden sm:inline">(negotiable)</span>}
            </span>
            <div className="flex items-center space-x-1">
              <Star className="w-3 h-3 text-yellow-400 fill-current" />
              <span className="text-xs text-slate-400">{favor.rating}</span>
            </div>
          </div>
          
          {/* Time-based expiration info */}
          <div className="flex items-center justify-between mt-2 text-xs">
            <button
              onClick={(e) => {
                e.stopPropagation();
                trackEvent('user_profile_click', 'engagement', 'favor_card');
                setLocation(`/user/${favor.posterId}`);
              }}
              className="text-slate-400 hover:text-favr-blue transition-colors duration-200 truncate mr-2"
            >
              by {favor.posterFirstName || favor.posterName || "Anonymous"}
            </button>
            <span className={`font-medium ${urgencyColor} text-xs sm:text-sm flex-shrink-0`}>
              {expirationInfo.timeRemaining}
            </span>
          </div>
        </div>
      </div>
    </InteractiveCard>
  );
}