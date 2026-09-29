// Scoring presets. Approach adapted from leadforge scorer `agency_opportunity` (MIT), reimplemented in TypeScript.
// All weights are points; the sum of maxima is 100. Overridable per campaign via filter.scoreWeights.
export interface ScoreWeights {
  siteGap: number; // max points for missing/poor web presence
  contactability: number; // whatsapp/phone/e-mail reachable
  rating: number;
  reviews: number; // demand proof
  unclaimedProfile: number; // Google profile not claimed = neglected presence
  socialPresence: number; // invests in social, but no site
  categoryMatch: number;
}

export const PRESETS: Record<string, ScoreWeights> = {
  agency_opportunity: { siteGap: 35, contactability: 20, rating: 10, reviews: 12, unclaimedProfile: 8, socialPresence: 8, categoryMatch: 7 },
  // Prefer established, well-rated businesses even if they have some web presence.
  established_focus: { siteGap: 25, contactability: 20, rating: 15, reviews: 20, unclaimedProfile: 5, socialPresence: 5, categoryMatch: 10 },
};

export const DEFAULT_PRESET = "agency_opportunity";

/** Share of `siteGap` points granted per site status. */
export const SITE_GAP_FACTOR: Record<string, number> = {
  NONE: 1,
  DEAD: 0.9,
  SOCIAL_ONLY: 0.85,
  FREE_BUILDER: 0.8,
  UNKNOWN: 0.3,
  HAS_SITE: 0,
};

export const TIER_THRESHOLDS = { hot: 70, warm: 45 };
