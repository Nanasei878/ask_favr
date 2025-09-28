import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MapPin, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { trackEvent } from "@/lib/analytics";

const countries = [
  "Afghanistan", "Albania", "Algeria", "Argentina", "Armenia", "Australia", "Austria", 
  "Azerbaijan", "Bahrain", "Bangladesh", "Belarus", "Belgium", "Bolivia", "Bosnia and Herzegovina", 
  "Brazil", "Bulgaria", "Cambodia", "Canada", "Chile", "China", "Colombia", "Croatia", 
  "Czech Republic", "Denmark", "Ecuador", "Egypt", "Estonia", "Finland", "France", 
  "Germany", "Ghana", "Greece", "Hungary", "Iceland", "India", "Indonesia", "Iran", 
  "Iraq", "Ireland", "Israel", "Italy", "Japan", "Jordan", "Kazakhstan", "Kenya", 
  "South Korea", "Kuwait", "Latvia", "Lebanon", "Lithuania", "Luxembourg", "Malaysia", 
  "Mexico", "Morocco", "Netherlands", "New Zealand", "Norway", "Pakistan", "Peru", 
  "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Saudi Arabia", 
  "Singapore", "Slovakia", "Slovenia", "South Africa", "Spain", "Sri Lanka", "Sweden", 
  "Switzerland", "Thailand", "Turkey", "Ukraine", "United Arab Emirates", "United Kingdom", 
  "United States", "Uruguay", "Venezuela", "Vietnam"
];

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [country, setCountry] = useState("");

  const completeMutation = useMutation({
    mutationFn: async (data: { dateOfBirth: string; country: string }) => {
      return await apiRequest("POST", "/api/auth/complete-onboarding", data);
    },
    onSuccess: () => {
      trackEvent('onboarding_completed', 'user', 'demographics');
      toast({
        title: "Welcome to Favr!",
        description: "Your profile is complete. Start exploring favors!",
      });
      setLocation('/');
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete onboarding",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!dateOfBirth) {
      toast({
        title: "Date of Birth Required",
        description: "Please select your date of birth",
        variant: "destructive",
      });
      return;
    }

    if (!country) {
      toast({
        title: "Country Required", 
        description: "Please select your country",
        variant: "destructive",
      });
      return;
    }

    // Validate age (must be 18+)
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 18) {
      toast({
        title: "Age Requirement",
        description: "You must be at least 18 years old to use Favr",
        variant: "destructive",
      });
      return;
    }

    completeMutation.mutate({ dateOfBirth, country });
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800 border-slate-700">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-favr-blue rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl text-white">Complete Your Profile</CardTitle>
          <CardDescription className="text-slate-300">
            Help us understand our community better by sharing a few details
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Date of Birth */}
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth" className="text-white flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Date of Birth
              </Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                max={new Date(Date.now() - 18 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                className="bg-slate-700 border-slate-600 text-white"
                required
              />
              <p className="text-xs text-slate-400">
                You must be at least 18 years old to use Favr
              </p>
            </div>

            {/* Country */}
            <div className="space-y-2">
              <Label htmlFor="country" className="text-white flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Country
              </Label>
              <Select value={country} onValueChange={setCountry} required>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="Select your country" />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  {countries.map((countryName) => (
                    <SelectItem key={countryName} value={countryName} className="text-white hover:bg-slate-600">
                      {countryName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400">
                This helps us understand our global community
              </p>
            </div>

            <Button
              type="submit"
              className="w-full bg-favr-blue hover:bg-blue-600 text-white"
              disabled={completeMutation.isPending}
            >
              {completeMutation.isPending ? "Completing..." : "Complete Profile"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}