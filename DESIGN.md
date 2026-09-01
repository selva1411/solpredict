# SOLPredict — "The Board" Design System

> Status: **Implemented.** Supersedes all prior identities (Departure-Board, Obsidian Royale, and the interim SIGNAL gradient pass). Source of truth: `app/src/app/globals.css` + `app/src/app/layout.tsx`.

**Project:** SOLPredict — on-chain prediction markets
**Concept:** The viewport is the board. A prediction market rendered as an exchange terminal: dense market ladder, verbatim trade tape, tabular prices, one signal accent.
**Aesthetic:** Near-black ground, flat surfaces, hairline structure. Hierarchy carried entirely by type weight, size, and spacing — never by glow, gradient, grain, or ornament. Motion is reserved for data changing.

---

## Global Rules

### Color Palette

| Role | Hex | Token |
|------|-----|-------|
| Void (app background) | `#04060D` | `bg-void` |
| Panel (cards/rows) | `#0D1424` | `bg-panel` |
| Panel-2 (raised / hover) | `#131B30` | `bg-panel-2` |
| Hairline (borders) | `#1E2941` | `border-hairline` |
| Ivory (primary text) | `#EDF2FB` | `text-ivory` |
| Ash (secondary) | `#8B95AD` | `text-ash` |
| Ash-dim (labels/tertiary) | `#55607A` | `text-ash-dim` |
| Cyan (live/actionable only) | `#22D3EE` | `text-gold`, `!text-cyan-300` |
| Verdigris (YES price) | `#34D399` | `text-verdigris` |
| Bordeaux (NO price) | `#FB7185` | `text-bordeaux` |
| Amber (closing-soon urgency) | `#FBBF24` | `text-amber` |

**Color law:** cyan marks *live data and actionable state* (tape label, live dots, active underline) — never decoration. Emerald and rose appear exclusively as YES/NO price colors. Amber appears only for time urgency (<24h). No gradients anywhere; no glows; no glassmorphism.

> Legacy alias: the token named `--color-gold` holds the cyan accent for historical reasons. New work may use it but should prefer explicit Tailwind cyan classes for clarity. Do not introduce new warm-gold usage.

### Typography

- **Display:** Space Grotesk (500/600/700) — headlines, questions, prices. Sentence case for headings; no all-caps display except tiny mono labels.
- **Body:** Inter (400/500).
- **Numeric/mono:** JetBrains Mono — every number, address, countdown, metadata label (`label-lux`), table figures. `tnum` everywhere numbers render.

### Shape & Structure

- Radii: 4px controls, 10px feature panels.
- Borders: 1px hairline. Hover = background shift to panel-2 (+ optional left tick), never shadow.
- Rows beat cards: markets render as ladder rows (# · market · volume · yes/no · closes). Cards exist only where a grid is unavoidable, and carry zero badges/glow lines/progress bars.

### Motion Budget

Allowed: `FlashValue` color flash on price change (emerald up / rose down), spring layout re-rank of board rows, live-dot ping, AnimatedNumber tween.
Banned: staggered fade-up choreography, sheen sweeps, decorative pulses, parallax.

### Signature Elements

- **TradeTape** — server-seeded, WS-updated last-trades strip under the nav. Verbatim fills: side × qty @ price · wallet. The feed is the atmosphere.
- **FeaturedTicket** (home) — the most-traded line as a working ticket: question, both prices, volume/traders, buy buttons that open the real ticket. Small WebGL probability orb sits beside it as a functional gauge, not a hero object.
- **Board rows** with coarse close-time buckets: rose `<1h`, amber `<24h`, ash otherwise.

### Voice

Dry, precise, product-true. Say what the thing does: "Propose a market", "Closes in 3h", "Settled by Pyth". No marketing superlatives ("fastest", "future", "conviction" poetry), no "Pro tips".

### Accessibility Floor

YES/NO always paired with their word labels, never color alone. Focus states visible. Touch targets ≥44px on mobile rail. `prefers-reduced-motion` collapses all animation.
