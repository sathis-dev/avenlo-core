// ====================================
// AVENLO CORE - PROOF-OF-VALUE TIERS
// Pure tier/threshold logic for autonomous role promotion
// ====================================
//
// Credit thresholds map a contributor's lifetime credit score to a Scepter
// tier (SYSTEM_MANIFESTO.md). Dependency-free so the threshold math is unit
// testable without Discord/Mongo/Redis.

export interface PromotionTier {
  /** Stable identifier. */
  key: string;
  /** Human-facing tier name. */
  name: string;
  /** Minimum lifetime credits required to hold this tier. */
  minCredits: number;
  /** Env var holding the Discord role id for this tier. */
  roleEnvVar: string;
  /** Optional fallback env var if the primary role id is unset. */
  fallbackRoleEnvVar?: string;
  /** Accent color for dashboards / embeds. */
  accent: string;
}

/**
 * Ordered ascending by minCredits. The three named Scepter tiers (Tactical,
 * Strategic, Sovereign) sit at 100 / 500 / 2000; 5000 is the Sovereign apex
 * milestone and reuses the Sovereign role unless ROLE_SOVEREIGN_PRIME is set.
 */
export const PROMOTION_TIERS: readonly PromotionTier[] = [
  {
    key: 'TACTICAL',
    name: 'Tactical',
    minCredits: 100,
    roleEnvVar: 'ROLE_TACTICAL',
    accent: '#10B981',
  },
  {
    key: 'STRATEGIC',
    name: 'Strategic',
    minCredits: 500,
    roleEnvVar: 'ROLE_STRATEGIC',
    accent: '#F59E0B',
  },
  {
    key: 'SOVEREIGN',
    name: 'Sovereign',
    minCredits: 2000,
    roleEnvVar: 'ROLE_SOVEREIGN',
    accent: '#D4AF37',
  },
  {
    key: 'SOVEREIGN_PRIME',
    name: 'Sovereign',
    minCredits: 5000,
    roleEnvVar: 'ROLE_SOVEREIGN_PRIME',
    fallbackRoleEnvVar: 'ROLE_SOVEREIGN',
    accent: '#D4AF37',
  },
];

/** All distinct tier role env vars (used to clear superseded roles). */
export const TIER_ROLE_ENV_VARS: readonly string[] = Array.from(
  new Set(
    PROMOTION_TIERS.flatMap((t) =>
      t.fallbackRoleEnvVar ? [t.roleEnvVar, t.fallbackRoleEnvVar] : [t.roleEnvVar]
    )
  )
);

/** Rank of a tier (its index in PROMOTION_TIERS); -1 means "no tier". */
export function tierRank(tier: PromotionTier | null): number {
  if (!tier) return -1;
  return PROMOTION_TIERS.findIndex((t) => t.key === tier.key);
}

/** Highest tier whose threshold is satisfied by `credits`, or null. */
export function tierForCredits(credits: number): PromotionTier | null {
  let result: PromotionTier | null = null;
  for (const tier of PROMOTION_TIERS) {
    if (credits >= tier.minCredits) {
      result = tier;
    }
  }
  return result;
}

/**
 * If moving from `before` to `after` credits advances the user into a higher
 * tier, return that newly-reached tier; otherwise null. Never returns a tier
 * for a downgrade or a lateral move.
 */
export function crossedThreshold(
  before: number,
  after: number
): PromotionTier | null {
  const previous = tierForCredits(before);
  const current = tierForCredits(after);
  if (!current) return null;
  if (tierRank(current) > tierRank(previous)) {
    return current;
  }
  return null;
}

/** Resolve the Discord role id for a tier from the environment. */
export function resolveTierRoleId(
  tier: PromotionTier,
  env: NodeJS.ProcessEnv = process.env
): string | undefined {
  return env[tier.roleEnvVar] || (tier.fallbackRoleEnvVar ? env[tier.fallbackRoleEnvVar] : undefined);
}
