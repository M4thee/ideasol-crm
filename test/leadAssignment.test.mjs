import assert from "node:assert/strict";
import test from "node:test";

import {
  getNearbyLeadCandidates,
  LOCAL_LEAD_ASSIGNMENT_TOLERANCE_KM,
} from "../lib/leadAssignment.ts";

test("do lokalnej rotacji trafiają doradcy oddaleni najwyżej o 10 km od najbliższego", () => {
  assert.deepEqual(
    getNearbyLeadCandidates([
      { userId: "andrzej", distanceKm: 12 },
      { userId: "jan", distanceKm: 20 },
      { userId: "mateusz", distanceKm: 23 },
    ]),
    [
      { userId: "andrzej", distanceKm: 12 },
      { userId: "jan", distanceKm: 20 },
    ]
  );
});

test("próg 10 km jest włącznie", () => {
  assert.deepEqual(
    getNearbyLeadCandidates([
      { userId: "andrzej", distanceKm: 5 },
      { userId: "jan", distanceKm: 5 + LOCAL_LEAD_ASSIGNMENT_TOLERANCE_KM },
    ]).map((candidate) => candidate.userId),
    ["andrzej", "jan"]
  );
});

test("wyraźnie dalszy doradca nie przejmuje leada od najbliższego", () => {
  assert.deepEqual(
    getNearbyLeadCandidates([
      { userId: "jan", distanceKm: 31 },
      { userId: "andrzej", distanceKm: 6 },
    ]),
    [{ userId: "andrzej", distanceKm: 6 }]
  );
});

test("brak użytecznych współrzędnych zwraca pustą grupę", () => {
  assert.deepEqual(
    getNearbyLeadCandidates([
      { userId: "andrzej", distanceKm: Number.POSITIVE_INFINITY },
    ]),
    []
  );
});
