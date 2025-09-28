import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Star, CheckCircle2, Euro } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { trackEvent } from "@/lib/analytics";
import { motion } from "framer-motion";

interface CompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  favorId: number;
  favorTitle: string;
  originalPrice: string;
  isHelper: boolean;
  userId: number;
}

export function CompletionModal({ 
  isOpen, 
  onClose, 
  favorId, 
  favorTitle, 
  originalPrice, 
  isHelper, 
  userId 
}: CompletionModalProps) {
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [negotiatedPrice, setNegotiatedPrice] = useState(originalPrice);
  const [showSuccess, setShowSuccess] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const completeFavorMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/favors/${favorId}/complete`, {
        negotiatedPrice: negotiatedPrice !== originalPrice ? negotiatedPrice : undefined,
        rating
      });
    },
    onSuccess: () => {
      trackEvent('favor_completed', 'completion', 'favor_completion_success', favorId);
      setShowSuccess(true);
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/favors"] });
      queryClient.invalidateQueries({ queryKey: [`/api/favors/${favorId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}/stats`] });
      
      setTimeout(() => {
        onClose();
        setShowSuccess(false);
      }, 2000);
    },
    onError: (error) => {
      toast({
        title: "Completion Failed",
        description: "Unable to mark favor as completed. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (showSuccess) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
          <div className="text-center py-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", duration: 0.6 }}
              className="mx-auto mb-4"
            >
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
            </motion.div>
            <h2 className="text-2xl font-bold text-green-400 mb-2">Favor Completed!</h2>
            <p className="text-slate-300">
              {isHelper ? "Great job helping out!" : "Thanks for using Favr!"}
            </p>
            <div className="text-sm text-slate-400 mt-2">
              This window will close automatically...
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center">
            Mark Favor Complete
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="text-center">
            <h3 className="font-semibold text-lg mb-2">{favorTitle}</h3>
            <p className="text-sm text-slate-400">
              {isHelper 
                ? "Mark this favor as completed and rate your experience" 
                : "Confirm the favor was completed and rate the helper"
              }
            </p>
          </div>

          {/* Final Price */}
          <div>
            <Label className="text-slate-300 mb-2 block">Final Price</Label>
            <div className="relative">
              <Euro className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <Input
                type="number"
                value={negotiatedPrice.replace('€', '')}
                onChange={(e) => setNegotiatedPrice(`${e.target.value}`)}
                className="pl-10 bg-slate-700 border-slate-600 text-white"
                placeholder="Final agreed price"
              />
            </div>
            {negotiatedPrice !== originalPrice && (
              <p className="text-xs text-blue-400 mt-1">
                Price changed from original {originalPrice}
              </p>
            )}
          </div>

          {/* Rating */}
          <div>
            <Label className="text-slate-300 mb-2 block">Rating</Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star 
                    className={`w-6 h-6 ${
                      star <= rating 
                        ? 'text-yellow-400 fill-current' 
                        : 'text-slate-500'
                    }`}
                  />
                </button>
              ))}
              <span className="ml-2 text-sm text-slate-400">
                {rating}/5 stars
              </span>
            </div>
          </div>

          {/* Optional Review */}
          <div>
            <Label className="text-slate-300 mb-2 block">
              Review (Optional)
            </Label>
            <Textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder={
                isHelper 
                  ? "How was your experience helping with this favor?" 
                  : "How was your experience with the helper?"
              }
              className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button
              onClick={() => completeFavorMutation.mutate()}
              disabled={completeFavorMutation.isPending}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              {completeFavorMutation.isPending ? "Completing..." : "Complete Favor"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}