import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Star, Award, Trophy, MapPin, Calendar, MessageCircle, TrendingUp } from "lucide-react";
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
  
  // Format user display name (First Name + Last Initial)
  const displayName = `${user.firstName} ${user.lastName.charAt(0)}.`;
  
  // Demo data for new users - will be replaced with real data later
  const profileData = {
    bio: "New Favr member ready to help the community!",
    ageGroup: "25-34",
    country: "Luxembourg",
    favrPoints: 0,
    completedFavrs: 0,
    averageRating: "0.0",
    totalRatings: 0,
    memberSince: new Date().toLocaleDateString(),
    isVerified: false,
    profilePicture: null
  };

  // Calculate user level and progress
  const getUserLevel = (points: number) => {
    const levels = [
      { level: 1, title: 'Newcomer', minPoints: 0, nextPoints: 100 },
      { level: 2, title: 'Helper', minPoints: 100, nextPoints: 300 },
      { level: 3, title: 'Community Star', minPoints: 300, nextPoints: 600 },
      { level: 4, title: 'Favr Expert', minPoints: 600, nextPoints: 1000 },
      { level: 5, title: 'Community Hero', minPoints: 1000, nextPoints: 1500 },
      { level: 6, title: 'Favr Master', minPoints: 1500, nextPoints: 2500 },
      { level: 7, title: 'Legend', minPoints: 2500, nextPoints: 5000 },
    ];

    const currentLevel = levels.find(level => points >= level.minPoints && points < level.nextPoints) || levels[levels.length - 1];
    const progress = currentLevel.nextPoints > 0 ? 
      Math.round(((points - currentLevel.minPoints) / (currentLevel.nextPoints - currentLevel.minPoints)) * 100) : 100;

    return { ...currentLevel, progress };
  };

  const level = getUserLevel(profileData.favrPoints);
  const memberSince = profileData.memberSince;

  const showComingSoon = (feature: string) => {
    toast({
      title: `${feature} - Coming Soon!`,
      description: "This feature is being developed and will be available soon.",
      duration: 3000,
    });
  };

  const getInitials = (username: string) => {
    return username.slice(0, 2).toUpperCase();
  };

  const achievements = [
    { name: "First Helper", description: "Completed your first favr", unlocked: profileData.completedFavrs >= 1 },
    { name: "Community Member", description: "Member for 30 days", unlocked: true },
    { name: "Reliable Helper", description: "Maintain 4+ star rating", unlocked: parseFloat(profileData.averageRating) >= 4.0 },
    { name: "Power User", description: "Complete 10 favrs", unlocked: profileData.completedFavrs >= 10 },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white text-gray-900 max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogTitle className="sr-only">User Profile</DialogTitle>
        
        {/* Header */}
        <div className="text-center py-6">
          <div className="w-20 h-20 bg-favr-blue rounded-full flex items-center justify-center mx-auto mb-4 relative">
            {profileData.profilePicture ? (
              <img 
                src={profileData.profilePicture} 
                alt="Profile" 
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-white text-2xl font-bold">{user.firstName.charAt(0)}{user.lastName.charAt(0)}</span>
            )}
            {profileData.isVerified && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs">✓</span>
              </div>
            )}
          </div>
          
          <h2 className="text-xl font-bold text-gray-900 mb-1">{displayName}</h2>
          <div className="flex items-center justify-center text-sm text-gray-500 mb-4">
            <Calendar className="w-4 h-4 mr-1" />
            Member since {memberSince}
          </div>
        </div>

        {/* Level and Points */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <Trophy className="w-5 h-5 text-favr-blue mr-2" />
              <span className="font-semibold">Level {level.level}</span>
              <Badge variant="secondary" className="ml-2 text-xs">{level.title}</Badge>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-favr-blue">{currentUser.favrPoints}</div>
              <div className="text-xs text-gray-500">Favr Points</div>
            </div>
          </div>
          
          {isNewUser ? (
            <div 
              className="text-center py-2 cursor-pointer" 
              onClick={() => showComingSoon("Progress Tracking")}
            >
              <p className="text-sm text-gray-600">Complete favrs to earn points and level up!</p>
            </div>
          ) : (
            <>
              <Progress value={level.progress} className="mb-2" />
              <div className="text-xs text-gray-500 text-center">
                Progress to Level {level.level + 1}: {level.progress}%
              </div>
              <div className="text-xs text-gray-500 text-center">
                {level.nextPoints - currentUser.favrPoints} points to next level
              </div>
            </>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div 
            className="text-center cursor-pointer"
            onClick={() => isNewUser ? showComingSoon("Favr Tracking") : undefined}
          >
            <div className="text-2xl font-bold text-gray-900">{currentUser.completedFavrs}</div>
            <div className="text-xs text-gray-500">Favrs Completed</div>
          </div>
          
          <div 
            className="text-center cursor-pointer"
            onClick={() => showComingSoon("Rating System")}
          >
            <div className="flex items-center justify-center">
              <div className="text-2xl font-bold text-gray-900">{currentUser.averageRating}</div>
              <Star className="w-4 h-4 text-yellow-400 ml-1" />
            </div>
            <div className="text-xs text-gray-500">{isNewUser ? "No ratings yet" : `${currentUser.totalRatings} ratings`}</div>
          </div>
          
          <div 
            className="text-center cursor-pointer"
            onClick={() => showComingSoon("Leaderboard")}
          >
            <div className="text-2xl font-bold text-gray-900">#{isNewUser ? "—" : "50"}</div>
            <div className="text-xs text-gray-500">Leaderboard</div>
          </div>
        </div>

        {/* About */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 mb-2">About</h3>
          <p className="text-sm text-gray-600">{currentUser.bio}</p>
        </div>

        {/* Achievements */}
        {!isNewUser && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Achievements</h3>
            <div className="space-y-2">
              {achievements.map((achievement, index) => (
                <div 
                  key={index}
                  className={`flex items-center p-2 rounded-lg ${
                    achievement.unlocked ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
                  }`}
                >
                  <Award className={`w-4 h-4 mr-3 ${achievement.unlocked ? 'text-green-600' : 'text-gray-400'}`} />
                  <div className="flex-1">
                    <div className={`text-sm font-medium ${achievement.unlocked ? 'text-green-900' : 'text-gray-500'}`}>
                      {achievement.name}
                    </div>
                    <div className={`text-xs ${achievement.unlocked ? 'text-green-700' : 'text-gray-400'}`}>
                      {achievement.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isNewUser && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Coming Soon Features</h3>
            <div className="space-y-2">
              {[
                { name: "Achievement System", description: "Unlock badges for helping others" },
                { name: "Rating & Reviews", description: "Rate and review favor exchanges" },
                { name: "Leaderboards", description: "See top community helpers" },
                { name: "Favor History", description: "Track your completed favrs" }
              ].map((feature, index) => (
                <div 
                  key={index}
                  className="flex items-center p-2 rounded-lg bg-blue-50 border border-blue-200 cursor-pointer"
                  onClick={() => showComingSoon(feature.name)}
                >
                  <TrendingUp className="w-4 h-4 mr-3 text-blue-600" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-blue-900">{feature.name}</div>
                    <div className="text-xs text-blue-700">{feature.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex space-x-3">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => showComingSoon("Profile Editing")}
          >
            Edit Profile
          </Button>
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => showComingSoon("Settings")}
          >
            Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}