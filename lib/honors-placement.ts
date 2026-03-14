import { getSeatsLeft } from "./class-model";

export type PlacementOffering = {
  id: string;
  title: string;
  code: string;
  capacity: number | null;
  enrolledCount: number;
  waitlistCount: number;
};

export type PlacementSuggestionOption = {
  offeringId: string;
  rank: number | null;
  eligible: boolean;
  seatsLeft: number | null;
};

export function getCapacityPressureLevel(input: {
  capacity: number | null;
  enrolledCount: number;
  waitlistCount?: number;
}) {
  const waitlistCount = input.waitlistCount ?? 0;
  const seatsLeft = getSeatsLeft(input.capacity, input.enrolledCount);

  if (seatsLeft === null) {
    return {
      level: waitlistCount > 0 ? "watch" : "open",
      label: waitlistCount > 0 ? `${waitlistCount} waitlisted` : "Open capacity",
    } as const;
  }

  if (seatsLeft <= 0) {
    return {
      level: "full",
      label: waitlistCount > 0 ? `Full • ${waitlistCount} waitlisted` : "Full",
    } as const;
  }

  if (waitlistCount > 0) {
    return {
      level: "waitlist",
      label: `${seatsLeft} left • ${waitlistCount} waitlisted`,
    } as const;
  }

  if (seatsLeft <= 2) {
    return {
      level: "tight",
      label: `${seatsLeft} left`,
    } as const;
  }

  return {
    level: "open",
    label: `${seatsLeft} left`,
  } as const;
}

export function suggestPlacement(options: PlacementSuggestionOption[]) {
  const rankedEligibleOpen = options
    .filter((option) => option.eligible && (option.seatsLeft === null || option.seatsLeft > 0))
    .sort((left, right) => {
      const leftRank = left.rank ?? Number.POSITIVE_INFINITY;
      const rightRank = right.rank ?? Number.POSITIVE_INFINITY;

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      const leftSeats = left.seatsLeft ?? Number.POSITIVE_INFINITY;
      const rightSeats = right.seatsLeft ?? Number.POSITIVE_INFINITY;
      return rightSeats - leftSeats;
    });

  return rankedEligibleOpen[0] ?? null;
}

