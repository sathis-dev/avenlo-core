import {
  PROMOTION_TIERS,
  tierForCredits,
  tierRank,
  crossedThreshold,
  resolveTierRoleId,
} from './tiers';

describe('proof-of-value tiers', () => {
  describe('tierForCredits', () => {
    it('returns null below the first threshold', () => {
      expect(tierForCredits(0)).toBeNull();
      expect(tierForCredits(99)).toBeNull();
    });

    it('maps each threshold band to the right named tier', () => {
      expect(tierForCredits(100)?.name).toBe('Tactical');
      expect(tierForCredits(499)?.name).toBe('Tactical');
      expect(tierForCredits(500)?.name).toBe('Strategic');
      expect(tierForCredits(1999)?.name).toBe('Strategic');
      expect(tierForCredits(2000)?.key).toBe('SOVEREIGN');
      expect(tierForCredits(4999)?.key).toBe('SOVEREIGN');
    });

    it('treats 5000 as the Sovereign apex milestone', () => {
      const apex = tierForCredits(5000);
      expect(apex?.key).toBe('SOVEREIGN_PRIME');
      expect(apex?.name).toBe('Sovereign');
      expect(apex?.minCredits).toBe(5000);
    });
  });

  describe('tierRank', () => {
    it('orders tiers ascending and treats null as -1', () => {
      expect(tierRank(null)).toBe(-1);
      expect(tierRank(PROMOTION_TIERS[0])).toBe(0);
      expect(tierRank(PROMOTION_TIERS[3])).toBe(3);
    });
  });

  describe('crossedThreshold', () => {
    it('returns the tier when a new threshold is crossed', () => {
      expect(crossedThreshold(50, 150)?.name).toBe('Tactical');
      expect(crossedThreshold(450, 600)?.name).toBe('Strategic');
      expect(crossedThreshold(1900, 2100)?.key).toBe('SOVEREIGN');
      expect(crossedThreshold(4900, 5100)?.key).toBe('SOVEREIGN_PRIME');
    });

    it('returns null when staying within the same tier', () => {
      expect(crossedThreshold(120, 150)).toBeNull();
      expect(crossedThreshold(600, 700)).toBeNull();
    });

    it('never promotes on a downgrade', () => {
      expect(crossedThreshold(2100, 150)).toBeNull();
    });
  });

  describe('resolveTierRoleId', () => {
    it('reads the tier role id from the environment', () => {
      const tactical = PROMOTION_TIERS[0];
      expect(resolveTierRoleId(tactical, { ROLE_TACTICAL: 'role-tac' })).toBe('role-tac');
    });

    it('falls back to ROLE_SOVEREIGN for the apex tier', () => {
      const apex = PROMOTION_TIERS[3];
      expect(resolveTierRoleId(apex, { ROLE_SOVEREIGN: 'role-sov' })).toBe('role-sov');
      expect(
        resolveTierRoleId(apex, { ROLE_SOVEREIGN_PRIME: 'role-prime', ROLE_SOVEREIGN: 'role-sov' })
      ).toBe('role-prime');
    });

    it('returns undefined when unconfigured', () => {
      expect(resolveTierRoleId(PROMOTION_TIERS[0], {})).toBeUndefined();
    });
  });
});
