import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Save, Trash2, User as UserIcon, Mail, Phone, MapPin, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";

export default function EditProfile() {
  const [, setLocation] = useLocation();
  const { user: currentUser, logout } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    bio: "",
    phoneNumber: "",
    country: ""
  });

  const { data: user, isLoading } = useQuery<User>({
    queryKey: [`/api/users/${currentUser?.id}`],
    enabled: !!currentUser?.id,

  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<User>) => {
      return await apiRequest("PATCH", `/api/users/${currentUser?.id}`, data, {
        'user-id': String(currentUser?.id)
      });
    },
    onSuccess: () => {
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${currentUser?.id}`] });
      setLocation(`/profile/${currentUser?.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update profile.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/users/${currentUser?.id}`, {}, {
        'user-id': String(currentUser?.id)
      });
    },
    onSuccess: () => {
      toast({
        title: "Account deleted",
        description: "Your account has been permanently deleted.",
      });
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Deletion failed",
        description: error.message || "Failed to delete account.",
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to permanently delete your account? This action cannot be undone.")) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-favr-blue border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Profile Not Found</h1>
          <Button onClick={() => setLocation('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation(`/profile/${currentUser?.id}`)}
            className="text-slate-300 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Profile
          </Button>
          <h1 className="text-2xl font-bold">Edit Profile</h1>
        </div>
      </div>

      <div className="p-6 max-w-2xl mx-auto">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center text-white">
              <UserIcon className="w-5 h-5 mr-2" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName" className="text-slate-300">First Name</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white mt-2"
                  placeholder="Enter your first name"
                />
              </div>
              <div>
                <Label htmlFor="lastName" className="text-slate-300">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white mt-2"
                  placeholder="Enter your last name"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="email" className="text-slate-300 flex items-center">
                <Mail className="w-4 h-4 mr-2" />
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="bg-slate-700 border-slate-600 text-white mt-2"
                placeholder="Enter your email"
              />
            </div>

            {/* Phone */}
            <div>
              <Label htmlFor="phoneNumber" className="text-slate-300 flex items-center">
                <Phone className="w-4 h-4 mr-2" />
                Phone Number
              </Label>
              <Input
                id="phoneNumber"
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                className="bg-slate-700 border-slate-600 text-white mt-2"
                placeholder="Enter your phone number"
              />
            </div>

            {/* Country */}
            <div>
              <Label htmlFor="country" className="text-slate-300 flex items-center">
                <MapPin className="w-4 h-4 mr-2" />
                Country
              </Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => handleInputChange('country', e.target.value)}
                className="bg-slate-700 border-slate-600 text-white mt-2"
                placeholder="Enter your country"
              />
            </div>

            {/* Bio */}
            <div>
              <Label htmlFor="bio" className="text-slate-300 flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                Bio
              </Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                className="bg-slate-700 border-slate-600 text-white mt-2 min-h-[100px]"
                placeholder="Tell others about yourself..."
              />
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-4 pt-4">
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="bg-favr-blue hover:bg-blue-600 text-white flex-1"
              >
                <Save className="w-4 h-4 mr-2" />
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
              
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {deleteMutation.isPending ? "Deleting..." : "Delete Account"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Account Stats */}
        <Card className="bg-slate-800 border-slate-700 mt-6">
          <CardHeader>
            <CardTitle className="text-white">Account Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-slate-700 rounded-lg p-4">
                <div className="text-2xl font-bold text-favr-blue">{user.favrPoints}</div>
                <div className="text-slate-300 text-sm">Favr Points</div>
              </div>
              <div className="bg-slate-700 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-400">{user.completedFavrs}</div>
                <div className="text-slate-300 text-sm">Completed</div>
              </div>
              <div className="bg-slate-700 rounded-lg p-4">
                <div className="text-2xl font-bold text-yellow-400">{user.averageRating}</div>
                <div className="text-slate-300 text-sm">Rating</div>
              </div>
              <div className="bg-slate-700 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-400">{user.totalRatings}</div>
                <div className="text-slate-300 text-sm">Reviews</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}