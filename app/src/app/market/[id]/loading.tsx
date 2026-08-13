export default function MarketDetailLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 animate-pulse">
      <div className="w-24 h-4 bg-panel-2 rounded skeleton-shimmer mb-6" />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="holo-card p-6 space-y-4">
            <div className="w-20 h-5 bg-panel-2 rounded-[2px] skeleton-shimmer" />
            <div className="w-3/4 h-8 bg-panel-2 rounded skeleton-shimmer" />
            <div className="w-1/2 h-4 bg-panel-2 rounded skeleton-shimmer" />
            <div className="flex gap-4">
              <div className="w-32 h-16 bg-panel-2 rounded skeleton-shimmer" />
              <div className="w-32 h-16 bg-panel-2 rounded skeleton-shimmer" />
              <div className="w-32 h-16 bg-panel-2 rounded skeleton-shimmer" />
            </div>
          </div>
          <div className="holo-card p-6">
            <div className="w-full h-64 bg-panel-2 rounded skeleton-shimmer" />
          </div>
          <div className="holo-card p-6">
            <div className="w-32 h-5 bg-panel-2 rounded skeleton-shimmer mb-4" />
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-full h-10 bg-panel-2 rounded skeleton-shimmer" />
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="holo-card p-6">
            <div className="w-24 h-5 bg-panel-2 rounded skeleton-shimmer mb-4" />
            <div className="w-full h-48 bg-panel-2 rounded skeleton-shimmer" />
          </div>
          <div className="holo-card p-6">
            <div className="w-20 h-5 bg-panel-2 rounded skeleton-shimmer mb-4" />
            <div className="w-full h-32 bg-panel-2 rounded skeleton-shimmer" />
          </div>
        </div>
      </div>
    </div>
  );
}
