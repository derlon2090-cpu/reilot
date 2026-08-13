# AI token entitlements

Renvix uses actual provider tokens and a refill-to-cap policy. Customer-facing token balances never apply artificial Pro multipliers and never display the selected model, cache statistics, or provider cost.

| Plan | Cycle allowance | Cycles per paid period | Maximum grant |
|---|---:|---:|---:|
| Free trial | 100,000 total | 1 | 100,000 |
| Starter | 1,000,000 | 4 | 4,000,000 |
| Professional | 3,000,000 | 4 | 12,000,000 |
| Business | 5,000,000 | 4 | 20,000,000 |

Each paid cycle is exactly 168 absolute hours. At a boundary, the old cycle is valid while `cycleStart <= now < cycleEnd`; the next cycle begins exactly at `cycleEnd`. A new cycle starts with `allowanceTokens = planWeeklyLimit`, `usedTokens = 0`, and `reservedTokens = 0`. Remaining balance from the prior cycle is retained in its closed ledger row but is never carried forward.

After day 28, cycle four remains the current ledger until the subscription period ends. Its remaining balance can be used, but it is never refilled. A successful new subscription period starts a new cycle one; a failed, expired, or suspended subscription creates no new entitlement.

Before every AI request, Renvix atomically reserves estimated input plus maximum output under a tenant advisory lock. Settlement releases the estimate and deducts only actual `response.usage` input and output tokens. Provider request IDs are unique, so replayed usage cannot be charged twice. Expired or failed requests release reservations.

The internal cost guard is separate from customer token entitlement. It records Flash/Pro, cache hit/miss, and estimated provider cost for administration, while the customer sees only actual token balance, progress, cycle, and refill time.
