# SOLPredict Mechanical Departure-Board Design Rules

All future workspace adjustments must align with this style system:

## 1. Design Aesthetic & Color Palette
- **Deep Base Boards**: Hex `#15171e` (charcoal) for main app screens.
- **Card Panels**: Hex `#0c0d12` (dark ink) with 2px borders using Hex `#2d3142`.
- **Highlights**: Mechanical warm Amber (`#ffa500`). Use for warnings, spotlights, values.
- **Outcome Signs**: YES outcomes must use flat forest green (`#235a34`). NO outcomes must use flat rust red (`#8e2424`).
- **Typography**: 
  - Eyebrows & Tickers: small, uppercase font-mono tracking-widest text.
  - Headers: bold font-display text.
  - Body Copy & Descriptions: clean font-sans text.

## 2. Interface Components
- **Split-Flap Indicators**: Render numerical data, slots, and stats using SplitFlapText/FlipCountdown tiles with matte backgrounds.
- **Tactile Switches**: Clickable tabs/filter buttons must use `.mechanical-switch-active` or `.mechanical-switch-inactive` with inset shadow/bevel details to feel physical.
- **WebGL**: Limit canvas items strictly to direct controls (like the 3D probability semicircle dial).
- **3D Hero Moment**: Lazy load the Drei `SplitFlapBoard3D` canvas on desktop; fall back to a simplified 2D CSS grid on mobile to keep views light and responsive.

## 3. Workspace Authority & Admin Wallet
- **Dad Wallet Default Admin**: Always use `dad8hrG9n3xoJcUVSZcVcoQQxbBhMS7CEypM2HR3wqf` ("dad wallet") as the default admin/guardian wallet in environment defaults, seed scripts, transfer scripts, and role checks.
