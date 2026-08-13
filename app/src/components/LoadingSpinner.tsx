export function LoadingSpinner({ size = "md", label }: { size?: "sm" | "md" | "lg"; label?: string }) {
  const sizeClasses = { sm: "w-4 h-4 border", md: "w-6 h-6 border-2", lg: "w-8 h-8 border-2" };
  return (
    <div className="flex flex-col items-center justify-center space-y-3 py-12">
      <div className={`${sizeClasses[size]} border-gold border-t-transparent rounded-[2px] animate-spin`} />
      {label && <p className="text-[13px] text-ash font-mono">{label}</p>}
    </div>
  );
}
