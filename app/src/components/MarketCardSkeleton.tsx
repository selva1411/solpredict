export function MarketCardSkeleton() {
  return (
    <div className="holo-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="h-4 w-16 rounded shimmer" />
        <div className="h-4 w-12 rounded shimmer" />
      </div>
      <div className="h-12 w-full rounded shimmer mb-4" />
      <div className="flex items-center gap-4 mb-4">
        <div className="w-16 h-16 rounded-full shimmer shrink-0" />
        <div className="flex-1 grid grid-cols-2 gap-2">
          <div className="h-12 rounded shimmer" />
          <div className="h-12 rounded shimmer" />
        </div>
      </div>
      <div className="h-6 w-full rounded shimmer mb-3" />
      <div className="flex justify-between">
        <div className="h-3 w-12 rounded shimmer" />
        <div className="h-3 w-12 rounded shimmer" />
      </div>
    </div>
  );
}
