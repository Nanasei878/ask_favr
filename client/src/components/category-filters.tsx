import { Button } from "@/components/ui/button";
import { Grid, Wrench, Car, Dog, Package, Truck, Settings } from "lucide-react";

interface CategoryFiltersProps {
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  availableCategories: string[];
}

export default function CategoryFilters({ selectedCategory, onCategoryChange, availableCategories }: CategoryFiltersProps) {
  const allCategories = [
    { name: 'All', icon: Grid, color: 'bg-gray-500' },
    { name: 'Handyman', icon: Wrench, color: 'bg-blue-500' },
    { name: 'Ride', icon: Car, color: 'bg-green-500' },
    { name: 'Moving', icon: Truck, color: 'bg-yellow-500' },
    { name: 'Plumbing', icon: Package, color: 'bg-orange-500' },
    { name: 'Pet Care', icon: Dog, color: 'bg-red-500' },
    { name: 'Others', icon: Settings, color: 'bg-purple-500' },
  ];

  // Filter to only show categories that exist in the data
  const categories = allCategories.filter(cat => 
    cat.name === 'All' || availableCategories.includes(cat.name)
  );

  return (
    <div className="flex space-x-2 sm:space-x-3 overflow-x-auto pb-2 scrollbar-hide">
      {categories.map((category) => {
        const Icon = category.icon;
        const isSelected = selectedCategory === category.name;
        
        return (
          <Button
            key={category.name}
            onClick={() => onCategoryChange(category.name)}
            variant="outline"
            className={`flex flex-col items-center p-2 sm:p-3 min-w-16 sm:min-w-20 h-auto border-2 transition-all flex-shrink-0 ${
              isSelected 
                ? 'border-favr-blue bg-favr-blue/20 text-favr-blue' 
                : 'border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300 bg-slate-800/50'
            }`}
          >
            <div className={`w-6 h-6 sm:w-8 sm:h-8 ${isSelected ? 'bg-favr-blue' : category.color} rounded-lg flex items-center justify-center mb-1`}>
              <Icon className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
            </div>
            <span className="text-xs font-medium">{category.name}</span>
          </Button>
        );
      })}
    </div>
  );
}