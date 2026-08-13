export default function RootLoading() {
  return (
    <div className="min-h-screen bg-void flex items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-[2px] animate-spin" />
        <p className="text-[13px] text-ash font-mono">Loading PREDICT-X...</p>
      </div>
    </div>
  );
}
