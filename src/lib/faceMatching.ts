export const FACE_DESCRIPTOR_LENGTH = 128;
export const FACE_STRONG_MATCH_THRESHOLD = 0.38;
export const FACE_DEFAULT_MATCH_THRESHOLD = 0.45;
export const FACE_EXTENDED_MATCH_THRESHOLD = 0.49;
export const FACE_UPLOAD_CANDIDATE_LIMIT = 80;
export const FACE_SEARCH_CANDIDATE_LIMIT = 120;

const PERSON_DECISIVE_MARGIN = 0.018;
const PERSON_SOFT_MARGIN = 0.01;

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

export function chooseBestPersonMatch(
  candidates: FaceCandidateRow[],
  excludedPersonIds?: Set<string>,
) {
  const summaries = summarizePersonCandidates(candidates, excludedPersonIds);
  const best = summaries[0];
  const second = summaries[1];

  if (!best) {
    return null;
  }

  const scoreMargin = second ? second.score - best.score : Number.POSITIVE_INFINITY;
  const isStrongSingle = best.bestDistance <= FACE_STRONG_MATCH_THRESHOLD;
  const isStableSingle =
    best.bestDistance <= FACE_DEFAULT_MATCH_THRESHOLD &&
    best.averageTopDistance <= FACE_EXTENDED_MATCH_THRESHOLD;
  const isSupportedCluster =
    best.bestDistance <= FACE_EXTENDED_MATCH_THRESHOLD &&
    best.strongSupportCount >= 2 &&
    best.uniquePhotoSupport >= 2;

  const hasConfidence = isStrongSingle || isStableSingle || isSupportedCluster;
  if (!hasConfidence) {
    return null;
  }

  const requiredMargin =
    isStrongSingle || best.uniquePhotoSupport >= 2 ? PERSON_SOFT_MARGIN : PERSON_DECISIVE_MARGIN;
  if (second && scoreMargin < requiredMargin && best.bestDistance > 0.355) {
    return null;
  }

  return best;
}
