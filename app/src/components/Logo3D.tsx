export function Logo3D() {
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
      <rect x="1" y="1" width="14" height="14" rx="1" fill="var(--color-gold)" stroke="var(--color-gold-deep)" strokeWidth="1.5" />
      <rect x="1" y="17" width="14" height="14" rx="1" fill="var(--color-panel-2)" stroke="var(--color-hairline-2)" strokeWidth="1.5" />
      <rect x="17" y="1" width="14" height="14" rx="1" fill="var(--color-panel-2)" stroke="var(--color-hairline-2)" strokeWidth="1.5" />
      <rect x="17" y="17" width="14" height="14" rx="1" fill="var(--color-panel-2)" stroke="var(--color-hairline-2)" strokeWidth="1.5" />
      <circle cx="8" cy="8" r="3" fill="var(--color-obsidian)" />
      <circle cx="8" cy="24" r="3" fill="var(--color-gold)" stroke="var(--color-gold-deep)" strokeWidth="1" />
      <circle cx="24" cy="8" r="3" fill="var(--color-gold)" stroke="var(--color-gold-deep)" strokeWidth="1" />
      <circle cx="24" cy="24" r="3" fill="var(--color-obsidian)" />
    </svg>
  );
}