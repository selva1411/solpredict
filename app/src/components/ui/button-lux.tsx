import { cn } from "@/lib/utils";

type V = "gold" | "ghost" | "quiet";
export function ButtonLux({
  variant = "gold", className, ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: V }) {
  const base =
    "inline-flex h-11 items-center justify-center gap-2 rounded-[2px] px-5 font-mono text-[11px] " +
    "uppercase tracking-[.16em] transition-colors disabled:opacity-40";
  const v: Record<V, string> = {
    gold:  "bg-gold text-void hover:bg-gold-lite",
    ghost: "border border-hairline text-ivory hover:border-gold-deep hover:text-gold-lite",
    quiet: "text-ash hover:text-ivory",
  };
  return <button className={cn(base, v[variant], "sheen", className)} {...p} />;
}
