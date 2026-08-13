export function Panel({
  children, feature = false, className = "",
}: { children: React.ReactNode; feature?: boolean; className?: string }) {
  return (
    <div className={`${feature ? "surface-feature" : "surface"} sheen ${className}`}>
      {feature && <div className="rule-gold absolute inset-x-0 top-0" />}
      {children}
    </div>
  );
}
