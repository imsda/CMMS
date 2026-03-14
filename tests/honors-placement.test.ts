import test from "node:test";
import assert from "node:assert/strict";

import { getCapacityPressureLevel, suggestPlacement } from "../lib/honors-placement";

test("capacity pressure reflects full and waitlisted offerings", () => {
  assert.deepEqual(getCapacityPressureLevel({ capacity: 10, enrolledCount: 10, waitlistCount: 0 }), {
    level: "full",
    label: "Full",
  });

  assert.deepEqual(getCapacityPressureLevel({ capacity: 10, enrolledCount: 9, waitlistCount: 2 }), {
    level: "waitlist",
    label: "1 left • 2 waitlisted",
  });
});

test("placement suggestion picks the highest-ranked eligible option with open seats", () => {
  const suggestion = suggestPlacement([
    {
      offeringId: "offering-1",
      rank: 1,
      eligible: true,
      seatsLeft: 0,
    },
    {
      offeringId: "offering-2",
      rank: 2,
      eligible: true,
      seatsLeft: 4,
    },
    {
      offeringId: "offering-3",
      rank: 3,
      eligible: false,
      seatsLeft: 10,
    },
  ]);

  assert.deepEqual(suggestion, {
    offeringId: "offering-2",
    rank: 2,
    eligible: true,
    seatsLeft: 4,
  });
});
