# Design System Master File (SOLPredict Departure-Board)

> **LOGIC:** When building or modifying a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** SOLPredict
**Concept:** Mechanical Departure-Board / Solari Board
**Aesthetics:** Industrial, segmented, tactical, high-contrast, mechanical text flaps.

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Base Board | `#15171E` | `--color-board-deep` (Background) |
| Panel Base | `#0C0D12` | `--color-board-panel` (Card/Dashboard) |
| Border | `#2D3142` | `--color-board-border` (Segment dividers) |
| Mechanical Amber | `#FFA500` | `--color-mechanical-amber` (Primary highlight) |
| YES Outcome | `#235A34` | `--color-yes-verdant` (Deep forest green) |
| NO Outcome | `#8E2424` | `--color-no-rust` (Rust vermillion) |
| Text Primary | `#F4F4F9` | `--color-text-primary` (Bone-white lettering) |
| Text Muted | `#808495` | `--color-text-muted` (Structural labels) |

**Color Notes:** Ink/charcoal board background with bone-white mechanical lettering and warm mechanical bulb amber accents. YES and NO outcomes are represented as solid green/red signage without neon glow.

### Typography

- **Heading Font:** Share Tech (transit/signage sans-serif)
- **Body Font:** IBM Plex Sans (clean, technical sans-serif)
- **Numeric Font:** Space Mono (monospace numbers/odds/timers)

**Google Fonts Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Share+Tech&family=Space+Mono:wght@400;700&display=swap');
```

---

## Component Specs

### 1. Board Panels (Replaces Glass Cards)
Solid dark panel with insert shadows:
```css
.board-panel {
  background-color: #0C0D12;
  border: 2px solid #2D3142;
  box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.8), 0 10px 30px rgba(0, 0, 0, 0.5);
  border-radius: 4px;
}
```

### 2. Signage Buttons
```css
.btn-amber {
  background-color: #FFA500;
  color: #050608;
  font-family: var(--font-share-tech);
  text-transform: uppercase;
  border: 2px solid #D48800;
  border-radius: 4px;
  box-shadow: 0 3px 0 #9E6600;
}
```

### 3. Split-Flap Numeric/Text Flaps
```css
.split-flap-char {
  width: 28px;
  height: 40px;
  background: linear-gradient(to bottom, #111216 0%, #15161C 49%, #050507 50%, #0C0D10 100%);
  border-left: 1px solid #000;
  border-right: 1px solid #333;
  color: #FFA500;
}
```

---

## Anti-Patterns (Do NOT Use)

- ❌ **Neon violet/cyan gradients** — Never use `#8B5CF6` to `#06B6D4` transitions.
- ❌ **Glassmorphism transparency** — Avoid semi-transparent white borders and backdrop-blur panels.
- ❌ **Emojis as icons** — Use clean structural icons (Lucide/Heroicons).
- ❌ **Floating ambient 3D elements** — No floating 3D coins/waves. WebGL should be used only for direct functional elements (e.g. dial).
- ❌ **Rounded smooth elements** — Stick to sharp or slightly rounded (4px) block offsets resembling physical tiles.
