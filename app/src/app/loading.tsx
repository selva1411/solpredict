export default function RootLoading() {
  return (
    <div className="min-h-screen bg-[#050507] flex items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-8 h-8 border-2 border-[#FFA500] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#808495] font-mono">Loading PREDICT-X...</p>
      </div>
    </div>
  );
}
