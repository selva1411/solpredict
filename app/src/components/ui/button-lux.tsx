import { cn } from "@/lib/utils";

type V = "gold" | "ghost" | "quiet";
export function ButtonLux({
  variant = "gold", className, ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: V }) {
  const base =
    "inline-flex h-11 items-center justify-center gap-2 rounded-lg px-6 font-medium text-[13px] " +
    "transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 " +
    "focus-visible:ring-offset-void focus-visible:outline-none active:translate-y-px disabled:opacity-40 " +
    "disabled:pointer-events-none";
  const v: Record<V, string> = {
    gold: "bg-gold text-white hover:bg-gold-deep",
    ghost: "border border-hairline text-ivory hover:border-gold hover:text-gold-lite",
    quiet: "text-ash hover:text-gold-lite",
  };
  return <button className={cn(base, v[variant], className)} {...p} />;
}