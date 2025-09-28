import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import FavorDetailModal from "@/components/favor-detail-modal";
import type { Favor } from "@shared/schema";

export default function FavorDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const favorId = params.favorId ? parseInt(params.favorId) : null;
  const [selectedFavor, setSelectedFavor] = useState<Favor | null>(null);

  // Fetch the specific favor
  const { data: favor, isLoading, error } = useQuery<Favor>({
    queryKey: [`/api/favors/${favorId}`],
    enabled: !!favorId,
  });

  // Fetch all favors to get complete data
  const { data: allFavors = [] } = useQuery<Favor[]>({
    queryKey: ["/api/favors"],
  });

  useEffect(() => {
    console.log('FavorDetail: favorId =', favorId, 'favor =', favor, 'allFavors count =', allFavors.length);
    if (favor) {
      console.log('FavorDetail: Using direct favor fetch:', favor.title);
      setSelectedFavor(favor);
    } else if (allFavors.length > 0 && favorId) {
      // Fallback: find favor in all favors list
      const foundFavor = allFavors.find(f => f.id === favorId);
      if (foundFavor) {
        console.log('FavorDetail: Using fallback favor from list:', foundFavor.title);
        setSelectedFavor(foundFavor);
      }
    }
  }, [favor, allFavors, favorId]);

  if (isLoading) {
    return (
      <div className="w-full bg-slate-900 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading favor...</p>
        </div>
      </div>
    );
  }

  if (error || !selectedFavor) {
    return (
      <div className="w-full bg-slate-900 min-h-screen flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-6xl mb-4">🤔</div>
          <h1 className="text-2xl font-bold text-white mb-4">Favor Not Found</h1>
          <p className="text-slate-400 mb-6">
            Sorry, we couldn't find the favor you're looking for.
          </p>
          <Button 
            onClick={() => setLocation('/')}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-slate-900 min-h-screen">
      {/* Header with back button */}
      <div className="bg-slate-800 border-b border-slate-700 p-4">
        <Button
          variant="ghost"
          onClick={() => setLocation('/')}
          className="text-slate-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>
      </div>

      {/* Favor Detail Modal - Always shown */}
      <div className="p-4">
        <FavorDetailModal
          favor={selectedFavor}
          isOpen={true}
          onClose={() => setLocation('/')}
        />
      </div>
    </div>
  );
}