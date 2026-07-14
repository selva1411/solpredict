# Design System — "Neon Glass Observatory"

Premium trading-terminal-from-2030 aesthetic: deep-space dark
canvas, glassmorphism cards floating over a live 3D scene, neon
gradient accents, buttery 60fps motion.

## Palette
- Background: radial gradient `#050510` → `#0B0B1E`
- Primary gradient: `#8B5CF6` (violet) → `#06B6D4` (cyan)
- YES: `#10E58C` (mint green)
- NO: `#FF4D6D` (hot coral)
- Text: `#F8FAFC` primary / `#94A3B8` muted
- Glass cards: `rgba(255,255,255,0.06)` fill + `backdrop-blur(20px)`
  + 1px `rgba(255,255,255,0.12)` border + subtle inner glow

## Typography
- Display/headings: **Space Grotesk**
- Body: **Inter**
- Numbers/prices/odds: **JetBrains Mono**, always `font-variant-numeric: tabular-nums`

## Component Tokens (define as Tailwind theme extensions)
- `--radius-glass: 20px`
- `--blur-glass: 20px`
- `--shadow-glow-yes: 0 0 24px rgba(16,229,140,0.35)`
- `--shadow-glow-no: 0 0 24px rgba(255,77,109,0.35)`
- `--gradient-primary: linear-gradient(135deg, #8B5CF6, #06B6D4)`

## Motion Principles (Framer Motion + GSAP)
- Page transitions: fade + rise (`y: 24 → 0`, 0.5s, custom cubic-bezier)
- Market cards: stagger in at 0.06s increments
- Numbers (odds/pools): count-up animation on change
- GSAP ScrollTrigger: landing-page section reveals + parallax
- Card hover: 3D tilt from pointer position (`rotateX`/`rotateY`,
  `transform-style: preserve-3d`) + glow border sweep
- Buttons: magnetic hover + press scale to 0.97

## Micro-Details Checklist
- [ ] Skeleton shimmer loaders for all async data
- [ ] Animated gradient border on "live" (Open) market cards
- [ ] Flip-clock style countdown timers to `end_ts`
- [ ] Toast notifications (sonner) linking to Solana Explorer devnet tx
- [ ] Liquid-fill animated probability bar
- [ ] Custom scrollbar styling
- [ ] Favicon + OG image for social sharing

## Accessibility & Performance Non-Negotiables
- [ ] Respect `prefers-reduced-motion` — disable all 3D/parallax,
      fall back to a static gradient background
- [ ] 3D Canvas is lazy-loaded and wrapped in `<Suspense>`
- [ ] `PerformanceMonitor` (drei) degrades particle count on weak GPUs
- [ ] Disable heavy 3D entirely on mobile viewport widths; use an
      animated CSS gradient mesh fallback instead
- [ ] Lighthouse performance score ≥ 85 on desktop before Phase 7 sign-off