import { cn } from "@/lib/utils";

export function Panel({
  children, feature = false, className = "",
}: { children: React.ReactNode; feature?: boolean; className?: string }) {
  return (
    <div className={cn("panel-lux", feature && "seam-leaf", className)}>
      {feature && <div className="rule-gold absolute inset-x-6 top-0" aria-hidden />}
      {children}
    </div>
  );
}