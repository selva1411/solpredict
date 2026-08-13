export function Rule({ className = "" }: { className?: string }) {
  return <div className={`rule-gold ${className}`} aria-hidden />;
}
