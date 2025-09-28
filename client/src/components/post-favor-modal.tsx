import { useState, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { X, Upload, Calendar as CalendarIcon, MapPin, Wrench, Car, Dog, Package, Truck, Settings, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation as useUserLocation } from "@/hooks/use-location";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { trackEvent } from "@/lib/analytics";
import type { InsertFavor } from "@shared/schema";
import { format } from "date-fns";

// Extend Window interface for favor coordinates
declare global {
  interface Window {
    favorPostingCoordinates?: {
      latitude: number;
      longitude: number;
    };
  }
}

interface PostFavorModalProps {
  isOpen: boolean;
  onClose: () => void;
  smartData?: any;
}

export default function PostFavorModal({ isOpen, onClose, smartData }: PostFavorModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { location } = useUserLocation();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  // Step tracking
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;
  
  // Form data
  const [category, setCategory] = useState(smartData?.category || "");
  const [title, setTitle] = useState(smartData?.title || "");
  const [description, setDescription] = useState(smartData?.description || "");
  const [price, setPrice] = useState(smartData?.estimatedPrice || "");
  const [isNegotiable, setIsNegotiable] = useState(smartData?.isNegotiable || false);
  const [timeframe, setTimeframe] = useState(smartData?.timeframe || "");
  const [date, setDate] = useState<Date>();
  const [address, setAddress] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);

  // Helper function to extract country from MapBox feature
  const getCountryFromFeature = (feature: any) => {
    const context = feature.context || [];
    for (const item of context) {
      if (item.id && item.id.startsWith('country.')) {
        const shortCode = item.short_code?.toLowerCase();
        if (shortCode === 'lu') return 'luxembourg';
        if (shortCode === 'se') return 'sweden';
        if (shortCode === 'de') return 'germany';
        if (shortCode === 'fr') return 'france';
        if (shortCode === 'be') return 'belgium';
      }
    }
    return '';
  };
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [images, setImages] = useState<File[]>([]);

  const categories = [
    { name: 'Handyman', icon: Wrench, color: 'bg-orange-500' },
    { name: 'Ride', icon: Car, color: 'bg-blue-500' },
    { name: 'Pet Care', icon: Dog, color: 'bg-green-500' },
    { name: 'Delivery', icon: Package, color: 'bg-purple-500' },
    { name: 'Moving', icon: Truck, color: 'bg-red-500' },
    { name: 'Others', icon: Settings, color: 'bg-purple-500' },
  ];

  // Address suggestions using MapBox Geocoding API
  const getAddressSuggestions = async (input: string) => {
    if (input.length < 3) {
      setAddressSuggestions([]);
      return;
    }
    
    try {
      // Make two API calls: one for Luxembourg-specific, one for general
      const luxembourgQuery = `${input} luxembourg`;
      const [luxembourgResponse, generalResponse] = await Promise.all([
        fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(luxembourgQuery)}.json?access_token=${import.meta.env.VITE_MAPBOX_TOKEN}&limit=5&types=address,poi,place,locality,neighborhood&language=en&country=lu`),
        fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(input)}.json?access_token=${import.meta.env.VITE_MAPBOX_TOKEN}&limit=8&types=address,poi,place,locality,neighborhood&language=en${location?.latitude && location?.longitude ? `&proximity=${location.longitude},${location.latitude}` : ''}`)
      ]);

      const [luxembourgData, generalData] = await Promise.all([
        luxembourgResponse.json(),
        generalResponse.json()
      ]);

      let allFeatures: any[] = [];
      
      // Add Luxembourg results first
      if (luxembourgData.features && luxembourgData.features.length > 0) {
        allFeatures = [...luxembourgData.features];
      }
      
      // Add general results, but filter out duplicates
      if (generalData.features && generalData.features.length > 0) {
        const existingIds = new Set(allFeatures.map(f => f.id));
        const newFeatures = generalData.features.filter((f: any) => !existingIds.has(f.id));
        allFeatures = [...allFeatures, ...newFeatures];
      }

      if (allFeatures.length > 0) {
        // Process all features (Luxembourg results are already first)
        const suggestions: string[] = allFeatures.slice(0, 8).map((feature: any) => {
          let placeName = feature.matching_place_name || feature.place_name;
          
          // Clean up repetitive parts
          const parts = placeName.split(', ');
          const cleanedParts: string[] = [];
          let lastPart = '';
          
          for (const part of parts) {
            if (part.toLowerCase() !== lastPart.toLowerCase()) {
              cleanedParts.push(part);
              lastPart = part;
            }
          }
          
          return cleanedParts.join(', ');
        });
        
        setAddressSuggestions(suggestions.slice(0, 8));
      }
    } catch (error) {
      console.error('Error fetching address suggestions:', error);
      setAddressSuggestions([]);
    }
  };

  // Debounced address suggestion function
  const debouncedGetSuggestions = useCallback(
    (input: string) => {
      const timeoutId = setTimeout(() => {
        getAddressSuggestions(input);
      }, 300);
      return () => clearTimeout(timeoutId);
    },
    []
  );

  const handleAddressChange = (value: string) => {
    setAddress(value);
    debouncedGetSuggestions(value);
  };

  const handleUseCurrentLocation = async () => {
    setUseCurrentLocation(true);
    
    try {
      // Get user's actual current position
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        });
      });

      const { latitude, longitude } = position.coords;
      
      // Use MapBox reverse geocoding to get address
      if (import.meta.env.VITE_MAPBOX_TOKEN) {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${import.meta.env.VITE_MAPBOX_TOKEN}&types=place,locality,neighborhood,address&language=en`
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.features && data.features.length > 0) {
            const addressName = data.features[0].place_name;
            setAddress(addressName);
            
            // Store coordinates in a ref for later use
            (window as any).favorPostingCoordinates = { latitude, longitude };
          }
        }
      }
      
      // Fallback: use location hook if available
      if (!address && location) {
        setAddress(location.address);
      }
      
    } catch (error) {
      console.warn('Could not get current location:', error);
      toast({
        title: "Location unavailable",
        description: "Please enter your address manually.",
        variant: "destructive",
      });
    }
    
    setUseCurrentLocation(false);
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setImages(prev => [...prev, ...files].slice(0, 3));
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const mutation = useMutation({
    mutationFn: async (data: InsertFavor) => {
      console.log('Sending favor data:', data);
      const response = await apiRequest("POST", "/api/favors", data);
      return response.json();
    },
    onSuccess: () => {
      // Track successful favor posting
      trackEvent('favor_posted', 'engagement', category, parseFloat(price) || 0);
      
      // Force refresh all favor-related data immediately
      queryClient.invalidateQueries({ queryKey: ["/api/favors"] });
      queryClient.refetchQueries({ queryKey: ["/api/favors"] });
      
      toast({
        title: "Favr posted!",
        description: "Your request has been published and people nearby can now help you.",
      });
      onClose();
      resetForm();
    },
    onError: (error) => {
      console.error('Error posting favor:', error);
      toast({
        title: "Error posting favr",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setCurrentStep(1);
    setCategory("");
    setTitle("");
    setDescription("");
    setPrice("");
    setIsNegotiable(false);
    setTimeframe("");
    setDate(undefined);
    setAddress("");
    setImages([]);
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    // Check authentication first
    if (!user) {
      setLocation('/auth');
      onClose();
      return;
    }

    // Validate required fields
    if (!price || parseFloat(price) <= 0) {
      toast({
        title: "Price required",
        description: "Please enter a valid price for your favor.",
        variant: "destructive",
      });
      return;
    }

    if (!address.trim()) {
      toast({
        title: "Address required",
        description: "Please provide a location for your favor.",
        variant: "destructive",
      });
      return;
    }

    // Try to get coordinates from current location first
    let favorLatitude = "49.6116"; // Luxembourg fallback
    let favorLongitude = "6.1319";
    
    // Use coordinates from "Use current location" if available
    if ((window as any).favorPostingCoordinates) {
      favorLatitude = (window as any).favorPostingCoordinates.latitude.toString();
      favorLongitude = (window as any).favorPostingCoordinates.longitude.toString();
    } else if (location?.latitude && location?.longitude) {
      // Use location hook coordinates
      favorLatitude = location.latitude.toString();
      favorLongitude = location.longitude.toString();
    } else {
      // Try to get current position immediately if none available
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 300000
          });
        });
        favorLatitude = position.coords.latitude.toString();
        favorLongitude = position.coords.longitude.toString();
      } catch (error) {
        console.warn('Could not get coordinates for favor posting:', error);
        // Will use Luxembourg fallback
      }
    }

    const favorData: InsertFavor = {
      title,
      description,
      category,
      price,
      isNegotiable,
      timeframe: date ? format(date, "PPP") : timeframe,
      address,
      latitude: favorLatitude,
      longitude: favorLongitude,
      posterId: user.id.toString(),
    };

    console.log('Submitting favor data:', favorData);
    mutation.mutate(favorData);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return category !== "";
      case 2: return title.trim() !== "" && description.trim() !== "" && price.trim() !== "" && parseFloat(price) > 0;
      case 3: return true; // Media is optional
      case 4: return timeframe !== "" || date !== undefined;
      case 5: return address.trim() !== "";
      default: return false;
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white mb-4">What type of help do you need?</h3>
            <div className="grid grid-cols-2 gap-3">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const isSelected = category === cat.name;
                
                return (
                  <Button
                    key={cat.name}
                    onClick={() => setCategory(cat.name)}
                    variant="outline"
                    className={`flex flex-col items-center p-4 h-auto border-2 transition-all ${
                      isSelected 
                        ? 'border-favr-blue bg-favr-blue/20 text-favr-blue' 
                        : 'border-slate-600 text-slate-400 hover:border-favr-blue hover:text-white hover:bg-slate-700 bg-slate-800/50'
                    }`}
                  >
                    <div className={`w-8 h-8 ${isSelected ? 'bg-favr-blue' : cat.color} rounded-lg flex items-center justify-center mb-2`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-sm font-medium">{cat.name}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white mb-4">Describe what you need</h3>
            <div>
              <Input
                placeholder="What do you need help with?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-400"
              />
            </div>
            <div>
              <Textarea
                placeholder="Provide more details about your request..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Input
                  type="number"
                  placeholder="Price (€)"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-400"
                />
              </div>
              <div className="flex items-center space-x-2 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2">
                <Switch
                  checked={isNegotiable}
                  onCheckedChange={setIsNegotiable}
                />
                <span className="text-sm text-slate-300">Negotiable</span>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white mb-4">Add photos (optional)</h3>
            <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
              />
              <label htmlFor="image-upload" className="cursor-pointer">
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-slate-400">Tap to add photos</p>
                <p className="text-xs text-slate-500 mt-1">Up to 3 photos</p>
              </label>
            </div>
            
            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {images.map((image, index) => (
                  <div key={index} className="relative">
                    <img
                      src={URL.createObjectURL(image)}
                      alt={`Upload ${index + 1}`}
                      className="w-full h-20 object-cover rounded-lg"
                    />
                    <Button
                      onClick={() => removeImage(index)}
                      variant="ghost"
                      size="icon"
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white hover:bg-red-600 rounded-full"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white mb-4">When do you need it?</h3>
            <div className="space-y-3">
              <Select 
                value={timeframe} 
                onValueChange={(value) => {
                  setTimeframe(value);
                  setDate(undefined); // Clear date when timeframe is selected
                }}
              >
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue placeholder="Choose timeframe" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600 text-white">
                  <SelectItem value="ASAP" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">As soon as possible</SelectItem>
                  <SelectItem value="Today" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Today</SelectItem>
                  <SelectItem value="This week" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">This week</SelectItem>
                  <SelectItem value="This weekend" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">This weekend</SelectItem>
                  <SelectItem value="Next week" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Next week</SelectItem>
                  <SelectItem value="Flexible" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">I'm flexible</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="text-center text-slate-400">or</div>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full bg-slate-800 border-slate-600 text-white hover:bg-slate-700"
                  >
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    {date ? format(date, "PPP") : "Pick a specific date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-slate-800 border-slate-600" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(newDate) => {
                      setDate(newDate);
                      setTimeframe(""); // Clear timeframe when date is selected
                    }}
                    disabled={(date) => date < new Date()}
                    initialFocus
                    className="bg-slate-800 text-white"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white mb-4">Where do you need it?</h3>
            <div className="space-y-3">
              <div className="relative">
                <Input
                  placeholder="Type any address worldwide (e.g., Kirchberg Luxembourg, Central Park NYC)"
                  value={address}
                  onChange={(e) => handleAddressChange(e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-400"
                  autoComplete="off"
                />
                {addressSuggestions.length > 0 && address.length >= 2 && (
                  <div className="absolute z-20 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {addressSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setAddress(suggestion);
                          setAddressSuggestions([]);
                        }}
                        className="w-full px-3 py-2 text-left text-white hover:bg-slate-700 text-sm transition-colors first:rounded-t-lg last:rounded-b-lg border-b border-slate-700 last:border-b-0"
                      >
                        <div className="flex items-center">
                          <MapPin className="w-3 h-3 mr-2 text-slate-400" />
                          {suggestion}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Manual input hint */}
              {address.length >= 3 && addressSuggestions.length === 0 && (
                <div className="text-xs text-slate-400 flex items-center">
                  <Info className="w-3 h-3 mr-1" />
                  If you can't find your location, you can type it manually and we'll use your current GPS coordinates
                </div>
              )}
              
              <Button
                onClick={handleUseCurrentLocation}
                variant="outline"
                disabled={useCurrentLocation}
                className="w-full bg-slate-800 border-slate-600 text-white hover:bg-slate-700"
              >
                <MapPin className="w-4 h-4 mr-2" />
                {useCurrentLocation ? "Getting location..." : "Use current location (approximate)"}
              </Button>
              
              <p className="text-xs text-slate-500">
                Your exact location won't be shared. We'll show an approximate area for privacy.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Post a Favr</DialogTitle>
          
          {/* Progress indicator */}
          <div className="flex items-center space-x-2 mt-4">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full ${
                  i + 1 <= currentStep ? 'bg-favr-blue' : 'bg-slate-700'
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-slate-400">Step {currentStep} of {totalSteps}</p>
        </DialogHeader>

        <div className="py-6">
          {renderStep()}
        </div>

        <div className="flex justify-between pt-4 border-t border-slate-700">
          <Button
            onClick={handleBack}
            disabled={currentStep === 1}
            className="bg-favr-blue hover:bg-blue-600 disabled:bg-slate-600 disabled:text-slate-400"
          >
            Back
          </Button>
          
          {currentStep === totalSteps ? (
            <Button
              onClick={handleSubmit}
              disabled={!canProceed() || mutation.isPending}
              className="bg-favr-blue hover:bg-blue-600"
            >
              {mutation.isPending ? "Posting..." : "Post Favr"}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="bg-favr-blue hover:bg-blue-600"
            >
              Next
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}