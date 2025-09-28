import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Star, Calendar, MapPin, ArrowRight, MessageCircle, DollarSign, User } from "lucide-react";
import { useLocation } from "wouter";
import { createPrivacyAwareLocation, getPrivateAddress } from "@shared/locationUtils";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { trackEvent } from "@/lib/analytics";
import { calculateFavorExpiration } from "@/lib/favorExpiration";
import type { FavorWithPoster } from "@shared/schema";

interface FavorDetailModalProps {
  favor: FavorWithPoster;
  isOpen: boolean;
  onClose: () => void;
}

export default function FavorDetailModal({ favor, isOpen, onClose }: FavorDetailModalProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Calculate expiration info
  const expirationInfo = calculateFavorExpiration(
    typeof favor.createdAt === 'string' ? favor.createdAt : favor.createdAt?.toISOString() || new Date().toISOString(),
    favor.timeframe
  );

  const acceptMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/favors/${favor.id}/accept`, {});
    },
    onSuccess: () => {
      toast({
        title: "Favor Accepted",
        description: "Chat room created! You can now message the poster.",
      });
      setLocation(`/chat/${favor.id}`);
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to accept favor",
        variant: "destructive",
      });
    }
  });

  const negotiateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/favors/${favor.id}/negotiate`, {});
    },
    onSuccess: () => {
      toast({
        title: "Negotiation Started",
        description: "Chat room created! You can now discuss terms.",
      });
      setLocation(`/chat/${favor.id}`);
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start negotiation",
        variant: "destructive",
      });
    }
  });

  const handleAccept = () => {
    if (!user) {
      setLocation('/auth');
      onClose();
      return;
    }
    acceptMutation.mutate();
  };

  const handleNegotiate = () => {
    if (!user) {
      setLocation('/auth');
      onClose();
      return;
    }
    negotiateMutation.mutate();
  };

  const categoryColors: Record<string, string> = {
    "Handyman": "bg-orange-500/20 text-orange-300 border-orange-500/30",
    "Ride": "bg-blue-500/20 text-blue-300 border-blue-500/30", 
    "Pet Care": "bg-green-500/20 text-green-300 border-green-500/30",
    "Delivery": "bg-purple-500/20 text-purple-300 border-purple-500/30",
    "Moving": "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    "Food": "bg-red-500/20 text-red-300 border-red-500/30",
    "Others": "bg-slate-500/20 text-slate-300 border-slate-500/30"
  };

  // Determine if current user is the owner of this favor
  const isOwner = user?.id?.toString() === favor.posterId?.toString();
  
  // Get privacy-aware location
  const locationData = {
    latitude: parseFloat(favor.latitude),
    longitude: parseFloat(favor.longitude),
    address: favor.address
  };
  
  const privacyLocation = createPrivacyAwareLocation(locationData, isOwner);

  // Use shared privacy function for consistent neighborhood display
  const areaName = getPrivateAddress(favor.address);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 max-h-[90vh] overflow-y-auto bg-slate-800 border-slate-700 text-white">
        <div className="slide-up">
          <div className="p-6">
            <DialogTitle className="sr-only">{favor.title}</DialogTitle>
            {/* Modal Handle */}
            <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-6"></div>
            
            {/* Favor Image */}
            {favor.imageUrl && (
              <div className="relative mb-4">
                <img 
                  src={favor.imageUrl}
                  alt={favor.title}
                  className="w-full h-48 rounded-xl object-cover"
                />
                <div className="absolute top-3 right-3 bg-white rounded-full px-3 py-1 flex items-center space-x-1">
                  <Star className="w-4 h-4 text-favr-orange fill-current" />
                  <span className="text-sm font-medium">{favor.rating}</span>
                </div>
              </div>
            )}

            {/* Favor Details */}
            <div className="mb-6">
              {/* Category Badge */}
              <div className="mb-3">
                <span className={`px-3 py-1 rounded-full text-sm font-medium border ${categoryColors[favor.category] || categoryColors["Others"]}`}>
                  {favor.category}
                </span>
              </div>
              
              <h2 className="text-xl font-bold text-white mb-2">{favor.title}</h2>
              <p className="text-slate-300 text-sm mb-4">{favor.description}</p>
              
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 rounded-full bg-slate-700 mr-3 flex items-center justify-center">
                  <span className="text-sm font-medium text-white">{favor.posterFirstName?.[0] || favor.posterName?.[0] || "U"}</span>
                </div>
                <div>
                  <button
                    onClick={() => {
                      trackEvent('user_profile_click', 'engagement', 'favor_detail');
                      setLocation(`/user/${favor.posterId}`);
                      onClose();
                    }}
                    className="font-medium text-white hover:text-favr-blue transition-colors duration-200 text-left"
                  >
                    {favor.posterName || "Anonymous User"}
                  </button>
                  <div className="text-sm text-slate-400">Verified Helper</div>
                </div>
              </div>
            </div>

            {/* Date & Location */}
            <div className="border border-slate-700 rounded-xl p-4 mb-6 bg-slate-800/50">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-medium text-white">Date</div>
                  <div className={`${expirationInfo.isExpired ? 'text-red-400 line-through' : 'text-slate-400'}`}>
                    {expirationInfo.isExpired ? 'Expired' : favor.timeframe}
                  </div>
                </div>
                <Calendar className="w-5 h-5 text-slate-400" />
              </div>
              
              <Separator className="my-3" />
              
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white">Location</div>
                  <div className="text-slate-400">{privacyLocation.displayAddress}</div>
                </div>
                <MapPin className="w-5 h-5 text-slate-400" />
              </div>
            </div>

            {/* Map Preview */}
            <div className="relative rounded-xl h-32 mb-6 overflow-hidden border border-slate-700">
              <img 
                src={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+3b82f6(${privacyLocation.displayLongitude},${privacyLocation.displayLatitude})/${privacyLocation.displayLongitude},${privacyLocation.displayLatitude},14,0/320x128@2x?access_token=${import.meta.env.VITE_MAPBOX_TOKEN}`}
                alt="Location map"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDMyMCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMjAiIGhlaWdodD0iMTI4IiBmaWxsPSIjMUUyOTNDIi8+CjxwYXRoIGQ9Ik0xNjAgNDhMMTcyIDY0SDE0OEwxNjAgNDhaIiBmaWxsPSIjM0I4MkY2Ii8+CjwvdHZnPg==';
                }}
              />
              <div className="absolute inset-0 bg-slate-900/20"></div>
            </div>

            {/* Cancellation Policy */}
            <div className="mb-6">
              <h3 className="font-medium text-black mb-2">Cancellation Policy</h3>
              <p className="text-sm text-slate-600 mb-2">
                Canceling may incur costs depending on timing. Please review our terms before booking.
              </p>
              <Button variant="link" className="text-favr-blue text-sm font-medium p-0 h-auto">
                Read More
              </Button>
            </div>

            {/* Price & CTA */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-white">
                  €{favor.price}
                  {favor.isNegotiable && <span className="text-sm text-slate-400 ml-2">(negotiable)</span>}
                </div>
                <div className="text-sm text-slate-400">Total price</div>
              </div>
              {!isOwner && (
                <div className="flex space-x-2">
                  <Button 
                    onClick={handleAccept}
                    disabled={acceptMutation.isPending}
                    className="bg-favr-blue text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-600 flex-1"
                  >
                    {acceptMutation.isPending ? (
                      <span>Creating chat...</span>
                    ) : (
                      <>
                        <span>Accept</span>
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                  {favor.isNegotiable && (
                    <Button 
                      onClick={handleNegotiate}
                      disabled={negotiateMutation.isPending}
                      variant="outline"
                      className="border-favr-blue text-favr-blue px-6 py-3 rounded-xl font-medium hover:bg-favr-blue hover:text-white"
                    >
                      {negotiateMutation.isPending ? "Starting..." : "Negotiate"}
                    </Button>
                  )}
                </div>
              )}
              {isOwner && (
                <div className="text-center">
                  <div className="text-sm text-slate-400">This is your favor</div>
                  <div className="text-xs text-slate-500 mt-1">You cannot accept your own favor</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
