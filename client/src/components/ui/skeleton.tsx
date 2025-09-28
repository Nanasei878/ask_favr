import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-slate-100 dark:bg-slate-800", className)}
      {...props}
    />
  )
}

// Favor card skeleton
function FavorCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
      <div className="flex justify-between items-start">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-6 w-12 rounded-full" />
      </div>
      
      <div className="flex items-center space-x-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="space-y-1 flex-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-2 w-16" />
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

// Category button skeleton
function CategorySkeleton() {
  return (
    <div className="flex flex-col items-center p-4 space-y-2">
      <Skeleton className="h-12 w-12 rounded-full" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

// User profile skeleton
function UserProfileSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
      <div className="flex items-center space-x-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center space-y-1">
          <Skeleton className="h-6 w-8 mx-auto" />
          <Skeleton className="h-3 w-16 mx-auto" />
        </div>
        <div className="text-center space-y-1">
          <Skeleton className="h-6 w-12 mx-auto" />
          <Skeleton className="h-3 w-12 mx-auto" />
        </div>
        <div className="text-center space-y-1">
          <Skeleton className="h-6 w-10 mx-auto" />
          <Skeleton className="h-3 w-14 mx-auto" />
        </div>
      </div>
      
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    </div>
  );
}

// Chat message skeleton
function ChatMessageSkeleton({ isOwn = false }) {
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-xs space-y-2 ${isOwn ? 'order-1' : 'order-2'}`}>
        <div className={`p-3 rounded-2xl ${
          isOwn ? 'bg-slate-100' : 'bg-slate-100'
        }`}>
          <Skeleton className="h-3 w-32 mb-1" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-2 w-12" />
      </div>
    </div>
  );
}

export { 
  Skeleton, 
  FavorCardSkeleton, 
  CategorySkeleton, 
  UserProfileSkeleton, 
  ChatMessageSkeleton 
}