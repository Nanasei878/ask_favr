import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Star, Award, Trophy, Calendar, MessageCircle, TrendingUp, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface UserProfileProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserProfile({ isOpen, onClose }: UserProfileProps) {
  const { toast } = useToast();
  const { user, logout } = useAuth();
  
  if (!user) return null;
  
  const displayName = `${user.firstName} ${user.lastName.charAt(0)}.`;
  
  const showComingSoon = (feature: string) => {
    toast({
      title: `${feature} - Coming Soon!`,
      description: "This feature is being developed and will be available soon.",
      duration: 3000,
    });
  };

  const handleLogout = () => {
    logout();
    onClose();
    toast({
      title: "Logged out successfully",
      description: "You have been logged out of your account.",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white text-gray-900 max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogTitle className="sr-only">User Profile</DialogTitle>
        
        {/* Header */}
        <div className="text-center py-6">
          <div className="w-20 h-20 bg-favr-blue rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">
              {user.firstName.charAt(0)}{user.lastName.charAt(0)}
            </span>
          </div>
          
          <h2 className="text-xl font-bold text-gray-900 mb-1">{displayName}</h2>
          <div className="flex items-center justify-center text-sm text-gray-500 mb-4">
            <Calendar className="w-4 h-4 mr-1" />
            New member
          </div>

          <div className="flex items-center justify-center space-x-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-favr-blue">0</div>
              <div className="text-xs text-gray-500">Favr Points</div>
            </div>
            <div className="w-px h-8 bg-gray-300"></div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">0</div>
              <div className="text-xs text-gray-500">Completed</div>
            </div>
            <div className="w-px h-8 bg-gray-300"></div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">New</div>
              <div className="text-xs text-gray-500">Rating</div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Level 1: Newcomer</span>
              <span className="text-sm text-gray-500">0/100 pts</span>
            </div>
            <Progress value={0} className="w-full" />
          </div>
        </div>

        {/* Bio Section */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
            <MessageCircle className="w-5 h-5 mr-2 text-favr-blue" />
            About
          </h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            New Favr member ready to help the community!
          </p>
        </div>

        {/* Coming Soon Features */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-favr-blue" />
            Features
          </h3>
          <div className="space-y-2">
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              onClick={() => showComingSoon("Favor Points")}
            >
              <Star className="w-4 h-4 mr-2" />
              View Favor Points History
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              onClick={() => showComingSoon("Ratings")}
            >
              <Award className="w-4 h-4 mr-2" />
              View Ratings & Reviews
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              onClick={() => showComingSoon("Achievements")}
            >
              <Trophy className="w-4 h-4 mr-2" />
              View Achievements
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4">
          <Button 
            variant="destructive" 
            className="w-full" 
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}