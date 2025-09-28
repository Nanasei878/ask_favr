import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { 
  User, 
  Star, 
  MapPin, 
  Calendar, 
  Trophy, 
  MessageCircle, 
  X,
  Edit3,
  Settings,
  Trash2,
  Shield,
  FileText,
  Lock,
  CreditCard,
  Info,
  ChevronRight,
  Bell,
  BellOff
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { User as UserType, Favor } from "@shared/schema";

interface UserProfileProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserProfile({ isOpen, onClose }: UserProfileProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteConfirm, setDeleteConfirm] = useState<{ favorId: number; title: string } | null>(null);
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | 'safety' | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(user?.notificationsEnabled ?? true);

  // Fetch user's posted and completed favors
  const { data: userFavors } = useQuery<{posted: Favor[], completed: Favor[]}>({
    queryKey: [`/api/favors/user/${user?.id}`],
    enabled: isOpen && !!user,
  });

  // Notification settings mutation
  const updateNotificationsMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await apiRequest("POST", "/api/notifications/settings", {
        userId: user?.id.toString(),
        enabled
      });
      return response.json();
    },
    onSuccess: (data) => {
      setNotificationsEnabled(data.notificationsEnabled);
      toast({
        title: data.notificationsEnabled ? "Notifications enabled" : "Notifications disabled",
        description: data.notificationsEnabled 
          ? "You'll receive notifications for new favors near you" 
          : "You won't receive push notifications",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Unable to update settings",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
      // Revert the switch position
      setNotificationsEnabled(!notificationsEnabled);
    },
  });

  // Delete favor mutation
  const deleteFavorMutation = useMutation({
    mutationFn: async (favorId: number) => {
      const response = await apiRequest("DELETE", `/api/favors/${favorId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Favor deleted successfully",
        description: "Your favor has been removed from the platform.",
      });
      // Force refresh all favor-related queries
      queryClient.invalidateQueries({ queryKey: ["/api/favors"] });
      queryClient.invalidateQueries({ queryKey: [`/api/favors/user/${user?.id}`] });
      queryClient.refetchQueries({ queryKey: ["/api/favors"] });
      queryClient.refetchQueries({ queryKey: [`/api/favors/user/${user?.id}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Unable to delete favor",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    },
  });

  const handleDeleteFavor = (favorId: number, favorTitle: string) => {
    setDeleteConfirm({ favorId, title: favorTitle });
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteFavorMutation.mutate(deleteConfirm.favorId);
      setDeleteConfirm(null);
    }
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return "U";
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  const FavorCard = ({ favor, showDelete = false }: { favor: Favor; showDelete?: boolean }) => {
    const isOwner = user?.id?.toString() === favor.posterId;
    const displayAddress = isOwner ? favor.address : favor.address.includes('area') ? favor.address : favor.address.split(',').slice(-2).join(',').trim() + ' area';
    
    return (
      <Card className="bg-slate-800 border-slate-700 mb-3">
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-semibold text-white text-sm">{favor.title}</h4>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-slate-700 text-slate-300">
                €{favor.price}
              </Badge>
              {showDelete && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteFavor(favor.id, favor.title)}
                  disabled={deleteFavorMutation.isPending}
                  className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
          <p className="text-slate-400 text-xs mb-2 line-clamp-2">{favor.description}</p>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-slate-500">{favor.category}</span>
            <span className="text-slate-500">{favor.timeframe}</span>
          </div>
          <div className="flex items-center text-xs text-slate-400">
            <MapPin className="w-3 h-3 mr-1" />
            <span>{displayAddress}</span>
          </div>
          {favor.status !== 'available' && (
            <Badge 
              variant="outline" 
              className={`mt-2 text-xs ${
                favor.status === 'completed' ? 'border-green-500 text-green-400' : 
                favor.status === 'accepted' ? 'border-blue-500 text-blue-400' : 
                'border-gray-500 text-gray-400'
              }`}
            >
              {favor.status}
            </Badge>
          )}
        </CardContent>
      </Card>
    );
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md mx-auto max-h-[85vh] overflow-hidden">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-xl font-bold text-white">Profile</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[70vh] space-y-6">
          {/* Profile Header */}
          <div className="flex items-center space-x-4">
            <Avatar className="w-16 h-16">
              <AvatarImage src={user.profilePicture || undefined} />
              <AvatarFallback className="bg-favr-blue text-white text-lg">
                {getInitials(user.firstName, user.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white">
                {user.firstName} {user.lastName?.[0]}.
              </h2>
              <p className="text-slate-400 text-sm">{user.bio || "Favr community member"}</p>
              <div className="flex items-center mt-1">
                <Star className="w-4 h-4 text-favr-orange fill-current mr-1" />
                <span className="text-sm text-slate-300">4.8 (12 reviews)</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-favr-blue">{userFavors?.posted?.length || 0}</div>
              <div className="text-xs text-slate-400">Posted</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{userFavors?.completed?.length || 0}</div>
              <div className="text-xs text-slate-400">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-favr-orange">156</div>
              <div className="text-xs text-slate-400">Points</div>
            </div>
          </div>



          {/* Favors Tabs */}
          <Tabs defaultValue="posted" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-slate-800">
              <TabsTrigger 
                value="posted" 
                className="data-[state=active]:bg-favr-blue data-[state=active]:text-white"
              >
                Posted Favors
              </TabsTrigger>
              <TabsTrigger 
                value="completed" 
                className="data-[state=active]:bg-favr-blue data-[state=active]:text-white"
              >
                Completed
              </TabsTrigger>
            </TabsList>

            <TabsContent value="posted" className="mt-4 space-y-3">
              {userFavors?.posted && userFavors.posted.length > 0 ? (
                userFavors.posted.map((favor: Favor) => (
                  <FavorCard key={favor.id} favor={favor} showDelete={true} />
                ))
              ) : (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-slate-300 mb-2">No posted favors</h3>
                  <p className="text-slate-500 text-sm">You haven't posted any favors yet</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="completed" className="mt-4 space-y-3">
              {userFavors?.completed && userFavors.completed.length > 0 ? (
                userFavors.completed.map((favor: Favor) => (
                  <FavorCard key={favor.id} favor={favor} showDelete={false} />
                ))
              ) : (
                <div className="text-center py-8">
                  <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-slate-300 mb-2">No completed favors</h3>
                  <p className="text-slate-500 text-sm">Complete your first favor to see it here</p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Settings Section */}
          <div className="pt-6 border-t border-slate-700 mt-6">
            <div className="space-y-3 mb-6">
              <h3 className="text-lg font-semibold text-white mb-4">Settings</h3>
              
              {/* Notification Toggle */}
              <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {notificationsEnabled ? (
                      <Bell className="w-5 h-5 text-blue-400" />
                    ) : (
                      <BellOff className="w-5 h-5 text-slate-400" />
                    )}
                    <div>
                      <div className="text-white font-medium">Push Notifications</div>
                      <div className="text-slate-400 text-sm">
                        {notificationsEnabled ? "Receive alerts for new favors nearby" : "No push notifications"}
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={notificationsEnabled}
                    onCheckedChange={(checked) => {
                      setNotificationsEnabled(checked);
                      updateNotificationsMutation.mutate(checked);
                    }}
                    disabled={updateNotificationsMutation.isPending}
                  />
                </div>
              </div>
            </div>

            {/* Legal & Security Section */}
            <div className="space-y-3 mb-6">
              <h3 className="text-lg font-semibold text-white mb-4">Legal & Security</h3>
              
              <div className="space-y-2">
                <button 
                  className="w-full text-left p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:bg-slate-800 transition-colors"
                  onClick={() => setLegalModal('privacy')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Shield className="w-5 h-5 text-green-400" />
                      <div>
                        <div className="text-white font-medium">Privacy Policy</div>
                        <div className="text-slate-400 text-sm">How we protect your data</div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
                </button>

                <button 
                  className="w-full text-left p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:bg-slate-800 transition-colors"
                  onClick={() => setLegalModal('terms')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <FileText className="w-5 h-5 text-blue-400" />
                      <div>
                        <div className="text-white font-medium">Terms of Service</div>
                        <div className="text-slate-400 text-sm">Community guidelines and rules</div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
                </button>

                <button 
                  className="w-full text-left p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:bg-slate-800 transition-colors"
                  onClick={() => setLegalModal('safety')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Lock className="w-5 h-5 text-orange-400" />
                      <div>
                        <div className="text-white font-medium">Safety Guidelines</div>
                        <div className="text-slate-400 text-sm">Stay safe while using Favr</div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
                </button>

                <button 
                  className="w-full text-left p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:bg-slate-800 transition-colors"
                  onClick={() => {
                    toast({
                      title: "Payment Protection - Coming Soon!",
                      description: "This feature is being developed and will be available soon.",
                      duration: 3000,
                    });
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <CreditCard className="w-5 h-5 text-purple-400" />
                      <div>
                        <div className="text-white font-medium">Payment Protection</div>
                        <div className="text-slate-400 text-sm">Secure transactions & escrow</div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
                </button>
              </div>

              <div className="bg-slate-800/30 rounded-lg p-4 mt-4">
                <div className="flex items-start space-x-3">
                  <Info className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div>
                    <div className="text-white font-medium text-sm mb-1">Community First</div>
                    <div className="text-slate-400 text-xs leading-relaxed">
                      Favr is built on trust and community. All transactions are protected by our escrow system, 
                      and we verify users to ensure a safe experience for everyone.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sign Out Button - Red and at bottom */}
          <div className="pt-4 border-t border-slate-700">
            <Button
              variant="destructive"
              className="w-full bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                localStorage.clear();
                window.location.href = '/';
              }}
            >
              Sign Out
            </Button>
          </div>

        </div>
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <Dialog open={true} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm mx-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-white">Delete Favor</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <p className="text-slate-300">
                Are you sure you want to delete "{deleteConfirm.title}"?
              </p>
              <p className="text-sm text-slate-400">
                This action cannot be undone.
              </p>
              
              <div className="flex space-x-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmDelete}
                  disabled={deleteFavorMutation.isPending}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  {deleteFavorMutation.isPending ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Legal & Security Modal */}
      {legalModal && (
        <Dialog open={true} onOpenChange={() => setLegalModal(null)}>
          <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg mx-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-white">
                {legalModal === 'privacy' && 'Privacy Policy'}
                {legalModal === 'terms' && 'Terms of Service'}
                {legalModal === 'safety' && 'Safety Guidelines'}
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                {legalModal === 'privacy' && 'How we protect your personal information'}
                {legalModal === 'terms' && 'Community guidelines and platform rules'}
                {legalModal === 'safety' && 'Best practices for safe interactions'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="overflow-y-auto max-h-[60vh] space-y-4 text-sm">
              {legalModal === 'privacy' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-white mb-2">Data Collection</h4>
                    <p className="text-slate-300">We collect only essential information needed to provide our service: your name, location for favor matching, and communication data for safety.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white mb-2">Location Privacy</h4>
                    <p className="text-slate-300">Your exact address is never shared publicly. We show approximate neighborhoods (like "Bonnevoie area") to protect your privacy while enabling local connections.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white mb-2">Data Security</h4>
                    <p className="text-slate-300">All personal data is encrypted and stored securely. We never sell your information to third parties.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white mb-2">Your Rights</h4>
                    <p className="text-slate-300">You can request to view, modify, or delete your data at any time. Contact us for data requests.</p>
                  </div>
                </div>
              )}

              {legalModal === 'terms' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-white mb-2">Community Standards</h4>
                    <p className="text-slate-300">Treat all community members with respect. Discrimination, harassment, or inappropriate behavior will result in account suspension.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white mb-2">Favor Guidelines</h4>
                    <p className="text-slate-300">Only post legitimate requests for help. Illegal activities, adult content, or dangerous tasks are prohibited.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white mb-2">Payment Terms</h4>
                    <p className="text-slate-300">All payments are processed securely. Favr takes a 10% service fee to maintain the platform and ensure safety.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white mb-2">Cancellation Policy</h4>
                    <p className="text-slate-300">Favors can be cancelled up to 2 hours before the scheduled time without penalty. Late cancellations may incur a 25% fee to compensate the helper. No-shows result in full payment forfeiture and may affect your community rating.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white mb-2">Account Responsibility</h4>
                    <p className="text-slate-300">You are responsible for your account security and all activities. Report suspicious behavior immediately.</p>
                  </div>
                </div>
              )}

              {legalModal === 'safety' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-white mb-2">Meeting Safety</h4>
                    <p className="text-slate-300">Always meet in public places for initial discussions. Trust your instincts - if something feels wrong, cancel the favor.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white mb-2">Identity Verification</h4>
                    <p className="text-slate-300">We verify user identities, but always confirm details yourself. Check profiles and ratings before accepting favors.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white mb-2">Communication</h4>
                    <p className="text-slate-300">Keep all communication within the app initially. Never share personal information like home address or financial details upfront.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white mb-2">Reporting Issues</h4>
                    <p className="text-slate-300">Report any concerning behavior, safety issues, or violations immediately. Our team responds within 24 hours.</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="pt-4 border-t border-slate-700">
              <Button
                onClick={() => setLegalModal(null)}
                className="w-full bg-favr-blue hover:bg-blue-600"
              >
                Got it
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}