import test from "node:test";
import assert from "node:assert/strict";

type OfferingState = { capacity: number; enrolledCount: number };

function tryReserveSeat(state: OfferingState): boolean {
  if (state.enrolledCount >= state.capacity) {
    return false;
  }

  state.enrolledCount += 1;
  return true;
}

test("capacity edge case: one remaining seat admits only one", async () => {
  const state: OfferingState = { capacity: 1, enrolledCount: 0 };

  const [first, second] = await Promise.all([Promise.resolve(tryReserveSeat(state)), Promise.resolve(tryReserveSeat(state))]);

  assert.equal([first, second].filter(Boolean).length, 1);
  assert.equal(state.enrolledCount, 1);
});

test("design: attendee can be in more than one offering", () => {
  const offerings = new Set<string>(["offering-a", "offering-b"]);
  assert.equal(offerings.size, 2);
});
