# Market Detail Page Override Specs

## Layout Design
*   **Dual-Column Dashboard:**
    *   **Left Column (Specs):** Details panel, mechanical probability gauge dial, order book depth grid, and chronological transaction log feed.
    *   **Right Column (Desktop Trade):** Desktop floating card container displaying YES/NO buttons, steppers, and cost calculations.
*   **Visual Gauge:** Split semicircle dial (`ProbabilityOrb3D`) with verdant green (`#235A34`) and rust red (`#8E2424`) segments, and a physical rotating pointer needle.

## Custom Features
*   **Decoded activity feed:** Parsed via Anchor's `EventParser` from parsed logs to show actual buyers, quantities, and costs for `SharesPurchased`, `MarketSettled`, and `RewardsClaimed` events.
*   **Implied Probability Trend:** Dynamic Sparkline charting the YES probability history generated chronologically from parsed events.
*   **Order Book Depth:** Displays YES/NO pool weight liquidity bands matching DeFi order book depth levels.
*   **Ergonomic Mobile Trade Panel:** Floating sticky footer that opens a sliding bottom sheet drawer for thumb-reachable one-handed transaction controls on phones.
