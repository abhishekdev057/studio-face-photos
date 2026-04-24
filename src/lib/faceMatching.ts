export const FACE_DESCRIPTOR_LENGTH = 128;
export const FACE_STRONG_MATCH_THRESHOLD = 0.38;
export const FACE_DEFAULT_MATCH_THRESHOLD = 0.45;
export const FACE_EXTENDED_MATCH_THRESHOLD = 0.49;
export const FACE_PUBLIC_CANDIDATE_THRESHOLD = 0.58;
export const FACE_UPLOAD_CANDIDATE_LIMIT = 80;
export const FACE_SEARCH_CANDIDATE_LIMIT = 120;

const PERSON_DECISIVE_MARGIN = 0.018;
const PERSON_SOFT_MARGIN = 0.01;

type MatchRules = {
  strongThreshold: number;
  stableThreshold: number;
  stableAverageThreshold: number;
  supportedThreshold: number;
  supportedAverageThreshold: number;
  minStrongSupport: number;
  minSupportCount: number;
  minUniquePhotoSupport: number;
  softScoreMargin: number;
  decisiveScoreMargin: number;
  softDistanceMargin: number;
  decisiveDistanceMargin: number;
  competitiveThreshold: number;
};

const INDEX_MATCH_RULES: MatchRules = {
  strongThreshold: 0.35,
  stableThreshold: 0.39,
  stableAverageThreshold: 0.425,
  supportedThreshold: 0.425,
  supportedAverageThreshold: 0.44,
  minStrongSupport: 2,
  minSupportCount: 2,
  minUniquePhotoSupport: 2,
  softScoreMargin: PERSON_SOFT_MARGIN,
  decisiveScoreMargin: PERSON_DECISIVE_MARGIN,
  softDistanceMargin: 0.012,
  decisiveDistanceMargin: 0.02,
  competitiveThreshold: 0.45,
};

const PUBLIC_MATCH_RULES: MatchRules = {
  strongThreshold: 0.315,
  stableThreshold: 0.355,
  stableAverageThreshold: 0.39,
  supportedThreshold: 0.38,
  supportedAverageThreshold: 0.405,
  minStrongSupport: 2,
  minSupportCount: 3,
  minUniquePhotoSupport: 2,
  softScoreMargin: 0.02,
  decisiveScoreMargin: 0.032,
  softDistanceMargin: 0.018,
  decisiveDistanceMargin: 0.028,
  competitiveThreshold: 0.43,
};

export type FaceCandidateRow = {
  personId: string | null;
  photoId: string;
  distance: number;
};

export type PersonMatchSummary = {
  personId: string;
  bestDistance: number;
  averageTopDistance: number;
  supportCount: number;
  strongSupportCount: number;
  uniquePhotoSupport: number;
  score: number;
};

export type MatchConfidence = "elite" | "verified" | "supported";

export type MatchRejectionReason = "no-candidates" | "low-support" | "ambiguous";

export type MatchDecision = {
  match: PersonMatchSummary | null;
  confidence?: MatchConfidence;
  reason?: MatchRejectionReason;
  summaries: PersonMatchSummary[];
  runnerUp?: PersonMatchSummary;
};

export function normalizeDescriptor(descriptor: number[]) {
  const vector = descriptor
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (vector.length !== FACE_DESCRIPTOR_LENGTH) {
    return null;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(magnitude) || magnitude === 0) {
    return null;
  }

  return vector.map((value) => value / magnitude);
}

export function summarizePersonCandidates(
  candidates: FaceCandidateRow[],
  excludedPersonIds: Set<string> = new Set(),
) {
  const grouped = new Map<string, FaceCandidateRow[]>();

  for (const candidate of candidates) {
    if (!candidate.personId || excludedPersonIds.has(candidate.personId)) {
      continue;
    }

    const current = grouped.get(candidate.personId) ?? [];
    current.push(candidate);
    grouped.set(candidate.personId, current);
  }

  const summaries: PersonMatchSummary[] = [];

  for (const [personId, matches] of grouped.entries()) {
    const ordered = matches
      .filter((match) => Number.isFinite(match.distance))
      .sort((left, right) => left.distance - right.distance)
      .slice(0, 8);

    if (ordered.length === 0) {
      continue;
    }

    const topDistances = ordered.slice(0, 4).map((match) => match.distance);
    const bestDistance = topDistances[0];
    const averageTopDistance =
      topDistances.reduce((sum, distance) => sum + distance, 0) / topDistances.length;
    const supportCount = ordered.filter(
      (match) => match.distance <= FACE_EXTENDED_MATCH_THRESHOLD,
    ).length;
    const strongSupportCount = ordered.filter(
      (match) => match.distance <= FACE_DEFAULT_MATCH_THRESHOLD,
    ).length;
    const uniquePhotoSupport = new Set(
      ordered
        .filter((match) => match.distance <= FACE_EXTENDED_MATCH_THRESHOLD)
        .map((match) => match.photoId),
    ).size;

    const score =
      bestDistance * 0.68 +
      averageTopDistance * 0.32 -
      Math.min(uniquePhotoSupport, 4) * 0.017 -
      Math.min(strongSupportCount, 3) * 0.012;

    summaries.push({
      personId,
      bestDistance,
      averageTopDistance,
      supportCount,
      strongSupportCount,
      uniquePhotoSupport,
      score,
    });
  }

  return summaries.sort(
    (left, right) =>
      left.score - right.score ||
      left.bestDistance - right.bestDistance ||
      right.uniquePhotoSupport - left.uniquePhotoSupport,
  );
}

function evaluateMatch(
  summaries: PersonMatchSummary[],
  rules: MatchRules,
) {
  const best = summaries[0];
  const second = summaries[1];

  if (!best) {
    return {
      match: null,
      reason: "no-candidates",
      summaries,
    } satisfies MatchDecision;
  }

  const hasEliteConfidence =
    best.bestDistance <= rules.strongThreshold &&
    (best.averageTopDistance <= rules.stableAverageThreshold + 0.02 || best.uniquePhotoSupport >= 2);
  const hasVerifiedConfidence =
    best.bestDistance <= rules.stableThreshold &&
    best.averageTopDistance <= rules.stableAverageThreshold &&
    best.strongSupportCount >= rules.minStrongSupport &&
    best.uniquePhotoSupport >= rules.minUniquePhotoSupport;
  const hasSupportedConfidence =
    best.bestDistance <= rules.supportedThreshold &&
    best.averageTopDistance <= rules.supportedAverageThreshold &&
    best.supportCount >= rules.minSupportCount &&
    best.uniquePhotoSupport >= rules.minUniquePhotoSupport;

  const confidence: MatchConfidence | null = hasEliteConfidence
    ? "elite"
    : hasVerifiedConfidence
      ? "verified"
      : hasSupportedConfidence
        ? "supported"
        : null;

  if (!confidence) {
    return {
      match: null,
      reason: "low-support",
      summaries,
      runnerUp: second,
    } satisfies MatchDecision;
  }

  if (second && second.bestDistance <= rules.competitiveThreshold) {
    const scoreMargin = second.score - best.score;
    const distanceMargin = second.bestDistance - best.bestDistance;
    const requiredScoreMargin =
      confidence === "elite" ? rules.softScoreMargin : rules.decisiveScoreMargin;
    const requiredDistanceMargin =
      confidence === "elite" ? rules.softDistanceMargin : rules.decisiveDistanceMargin;
    const runnerUpHasMaterialSupport =
      second.strongSupportCount >= Math.max(1, rules.minStrongSupport - 1) ||
      second.uniquePhotoSupport >= Math.max(1, rules.minUniquePhotoSupport - 1);

    if (
      runnerUpHasMaterialSupport &&
      (scoreMargin < requiredScoreMargin || distanceMargin < requiredDistanceMargin)
    ) {
      return {
        match: null,
        reason: "ambiguous",
        summaries,
        runnerUp: second,
      } satisfies MatchDecision;
    }
  }

  return {
    match: best,
    confidence,
    summaries,
    runnerUp: second,
  } satisfies MatchDecision;
}

export function chooseBestPersonMatch(
  candidates: FaceCandidateRow[],
  excludedPersonIds?: Set<string>,
) {
  const summaries = summarizePersonCandidates(candidates, excludedPersonIds);
  return evaluateMatch(summaries, INDEX_MATCH_RULES).match;
}

export function choosePublicPersonMatch(candidates: FaceCandidateRow[]) {
  const summaries = summarizePersonCandidates(candidates);
  return evaluateMatch(summaries, PUBLIC_MATCH_RULES);
}

export function expandPublicMatchedPeople(decision: MatchDecision) {
  if (!decision.match) {
    return [];
  }

  const primary = decision.match;
  const maxBestDistanceGap = decision.confidence === "elite" ? 0.04 : 0.028;
  const maxAverageGap = decision.confidence === "elite" ? 0.05 : 0.035;
  const maxScoreGap = decision.confidence === "elite" ? 0.065 : 0.04;

  return decision.summaries
    .filter((summary) => {
      if (summary.personId === primary.personId) {
        return true;
      }

      const bestDistanceGap = summary.bestDistance - primary.bestDistance;
      const averageGap = summary.averageTopDistance - primary.averageTopDistance;
      const scoreGap = summary.score - primary.score;
      const hasCloseFace = summary.bestDistance <= Math.min(0.39, primary.bestDistance + 0.05);
      const hasAnyMeaningfulSupport =
        summary.strongSupportCount >= 1 ||
        summary.supportCount >= 1 ||
        summary.uniquePhotoSupport >= 1;
      const isTooCompetitive =
        summary.bestDistance <= 0.39 &&
        scoreGap < 0.016 &&
        summary.strongSupportCount >= 2 &&
        summary.uniquePhotoSupport >= 2;

      return (
        bestDistanceGap <= maxBestDistanceGap &&
        averageGap <= maxAverageGap &&
        scoreGap <= maxScoreGap &&
        hasCloseFace &&
        hasAnyMeaningfulSupport &&
        !isTooCompetitive
      );
    })
    .slice(0, 4);
}

export function getPublicPhotoDistanceCutoff(summary: PersonMatchSummary) {
  return Math.min(
    0.44,
    Math.max(
      0.365,
      Math.min(summary.averageTopDistance + 0.05, summary.bestDistance + 0.08),
    ),
  );
}
