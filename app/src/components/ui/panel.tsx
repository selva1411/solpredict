import { cn } from "@/lib/utils";

export function Panel({
  children, feature = false, className = "",
}: { children: React.ReactNode; feature?: boolean; className?: string }) {
  return (
    <div className={cn("surface", className)}>
      {feature && <div className="h-0.5 bg-gold" aria-hidden />}
      {children}
    </div>
  );
}