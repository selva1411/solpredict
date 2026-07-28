export function LoadingSpinner({ size = "md", label }: { size?: "sm" | "md" | "lg"; label?: string }) {
  const sizeClasses = { sm: "w-4 h-4 border", md: "w-6 h-6 border-2", lg: "w-8 h-8 border-2" };
  return (
    <div className="flex flex-col items-center justify-center space-y-3 py-12">
      <div className={`${sizeClasses[size]} border-[#7B3FE4] border-t-transparent rounded-full animate-spin`} />
      {label && <p className="text-sm text-[#A5A8B8] font-mono">{label}</p>}
    </div>
  );
}
