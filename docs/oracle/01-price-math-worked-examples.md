# Oracle Price Math — Worked Examples

Put this table directly into code comments above the settlement
exponent-normalization logic, and also in the README.

## Example 1: Same Exponent
Pyth returns: `price = 26_712_345_678`, `expo = -8`
→ real price = $267.12345678

Market target: `target_price = 250_00000000`, `target_expo = -8`
→ real target = $250.00000000

Same exponent → compare directly (no scaling needed):
`267.12... > 250.00...` → **YES wins** (assuming `comparison == GreaterThan`).

## Example 2: Different Exponents
Pyth returns: `price = 267_123`, `expo = -3` → $267.123
Market target: `target_price = 25000`, `target_expo = -2` → $250.00

Expo diff = `target_expo - price_expo = -2 - (-3) = 1`
Scale price down by 10^1 to match target's expo, OR scale target
up — pick whichever avoids precision loss. In i128:
