import { useState } from "react";
import { Heart, Bookmark, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface LikeButtonProps {
  favorId: number;
  initialLiked?: boolean;
  likeCount?: number;
  onLike?: (favorId: number, liked: boolean) => void;
}

export function LikeButton({ favorId, initialLiked = false, likeCount = 0, onLike }: LikeButtonProps) {
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [count, setCount] = useState(likeCount);
  const [isAnimating, setIsAnimating] = useState(false);
  const { toast } = useToast();

  const handleLike = async () => {
    if (isAnimating) return;

    setIsAnimating(true);
    const newLikedState = !isLiked;
    
    setIsLiked(newLikedState);
    setCount(prev => newLikedState ? prev + 1 : prev - 1);

    // Create sparkle effect
    if (newLikedState) {
      createSparkleEffect();
    }

    // API call simulation
    try {
      // await apiRequest("POST", `/api/favors/${favorId}/like`, { liked: newLikedState });
      onLike?.(favorId, newLikedState);
    } catch (error) {
      // Revert on error
      setIsLiked(!newLikedState);
      setCount(prev => newLikedState ? prev - 1 : prev + 1);
      toast({
        title: "Action failed",
        description: "Please try again",
        variant: "destructive"
      });
    }

    setTimeout(() => setIsAnimating(false), 600);
  };

  const createSparkleEffect = () => {
    // Create floating sparkles
    const sparkles = document.createElement('div');
    sparkles.className = 'fixed pointer-events-none z-50';
    sparkles.style.left = '50%';
    sparkles.style.top = '50%';
    sparkles.innerHTML = '✨💫⭐';
    document.body.appendChild(sparkles);

    setTimeout(() => {
      document.body.removeChild(sparkles);
    }, 1000);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleLike}
      className={`
        group relative overflow-hidden transition-all duration-300 
        ${isLiked ? 'text-red-500 hover:text-red-600' : 'text-gray-400 hover:text-red-500'}
        ${isAnimating ? 'scale-110' : 'scale-100'}
        hover:bg-red-50 focus:ring-2 focus:ring-red-200 focus:outline-none
      `}
      aria-label={isLiked ? 'Unlike this favor' : 'Like this favor'}
      aria-pressed={isLiked}
    >
      <div className="flex items-center space-x-1">
        <Heart 
          className={`
            w-4 h-4 transition-all duration-300 
            ${isLiked ? 'fill-current scale-110' : 'scale-100'}
            ${isAnimating ? 'animate-bounce' : ''}
          `}
        />
        {count > 0 && (
          <span className={`
            text-xs font-medium transition-all duration-300
            ${isAnimating ? 'animate-pulse' : ''}
          `}>
            {count}
          </span>
        )}
      </div>
      
      {/* Shimmer effect on hover */}
      <div className="
        absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent
        -translate-x-full group-hover:translate-x-full transition-transform duration-700
      " />
    </Button>
  );
}

interface BookmarkButtonProps {
  favorId: number;
  initialBookmarked?: boolean;
  onBookmark?: (favorId: number, bookmarked: boolean) => void;
}

export function BookmarkButton({ favorId, initialBookmarked = false, onBookmark }: BookmarkButtonProps) {
  const [isBookmarked, setIsBookmarked] = useState(initialBookmarked);
  const [isAnimating, setIsAnimating] = useState(false);
  const { toast } = useToast();

  const handleBookmark = async () => {
    if (isAnimating) return;

    setIsAnimating(true);
    const newBookmarkedState = !isBookmarked;
    
    setIsBookmarked(newBookmarkedState);

    if (newBookmarkedState) {
      toast({
        title: "Saved to Watchlist",
        description: "You can view your saved favors in your profile",
        duration: 2000,
      });
    }

    // API call simulation
    try {
      // await apiRequest("POST", `/api/favors/${favorId}/bookmark`, { bookmarked: newBookmarkedState });
      onBookmark?.(favorId, newBookmarkedState);
    } catch (error) {
      setIsBookmarked(!newBookmarkedState);
      toast({
        title: "Action failed", 
        description: "Please try again",
        variant: "destructive"
      });
    }

    setTimeout(() => setIsAnimating(false), 400);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleBookmark}
      className={`
        group relative overflow-hidden transition-all duration-300
        ${isBookmarked ? 'text-blue-500 hover:text-blue-600' : 'text-gray-400 hover:text-blue-500'}
        ${isAnimating ? 'scale-110' : 'scale-100'}
        hover:bg-blue-50 focus:ring-2 focus:ring-blue-200 focus:outline-none
      `}
      aria-label={isBookmarked ? 'Remove from watchlist' : 'Add to watchlist'}
      aria-pressed={isBookmarked}
    >
      <Bookmark 
        className={`
          w-4 h-4 transition-all duration-300
          ${isBookmarked ? 'fill-current scale-110' : 'scale-100'}
          ${isAnimating ? 'animate-pulse' : ''}
        `}
      />
      
      {/* Shine effect on interaction */}
      {isAnimating && (
        <div className="
          absolute inset-0 bg-gradient-to-r from-transparent via-yellow-200/30 to-transparent
          animate-pulse
        " />
      )}
    </Button>
  );
}

interface FloatingActionButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  ariaLabel: string;
}

export function FloatingActionButton({ children, onClick, className = "", ariaLabel }: FloatingActionButtonProps) {
  const [isPressed, setIsPressed] = useState(false);

  return (
    <Button
      onClick={onClick}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      className={`
        relative overflow-hidden transition-all duration-200
        ${isPressed ? 'scale-95' : 'scale-100 hover:scale-105'}
        shadow-lg hover:shadow-xl active:shadow-md
        focus:ring-4 focus:ring-blue-200 focus:outline-none
        ${className}
      `}
      aria-label={ariaLabel}
    >
      {children}
      
      {/* Ripple effect */}
      <div className="
        absolute inset-0 bg-white/20 rounded-full scale-0 
        group-active:scale-100 transition-transform duration-300
      " />
    </Button>
  );
}

interface InteractiveCardProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  isClickable?: boolean;
}

export function InteractiveCard({ children, onClick, className = "", isClickable = true }: InteractiveCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        transition-all duration-300 ease-out
        ${isClickable ? 'cursor-pointer' : ''}
        ${isHovered && isClickable ? 'transform -translate-y-1 shadow-lg' : 'shadow-md'}
        hover:shadow-xl focus-within:ring-2 focus-within:ring-blue-200 focus-within:outline-none
        ${className}
      `}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      {children}
      
      {/* Subtle glow effect on hover */}
      {isHovered && isClickable && (
        <div className="
          absolute inset-0 bg-gradient-to-r from-blue-400/5 via-purple-400/5 to-blue-400/5
          rounded-inherit pointer-events-none
        " />
      )}
    </div>
  );
}

// Pulse animation for loading states
export function PulseLoader({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-flex items-center space-x-1 ${className}`}>
      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
    </div>
  );
}