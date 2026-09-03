export const LOCAL_LEAD_ASSIGNMENT_TOLERANCE_KM = 10;

export type LeadCandidateDistance = {
  userId: string;
  distanceKm: number;
};

export function getNearbyLeadCandidates(
  candidates: LeadCandidateDistance[],
  toleranceKm = LOCAL_LEAD_ASSIGNMENT_TOLERANCE_KM
) {
  const rankedCandidates = candidates
    .filter(
      (candidate) =>
        Number.isFinite(candidate.distanceKm) && candidate.distanceKm >= 0
    )
    .sort(
      (first, second) =>
        first.distanceKm - second.distanceKm ||
        first.userId.localeCompare(second.userId)
    );

  const nearestDistanceKm = rankedCandidates[0]?.distanceKm;
  if (nearestDistanceKm === undefined) return [];

  return rankedCandidates.filter(
    (candidate) => candidate.distanceKm - nearestDistanceKm <= toleranceKm
  );
}
