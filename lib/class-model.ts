export const CLASS_ASSIGNMENT_POLICY = "One class enrollment per attendee per timeslot.";

export type EnrollmentConflictCandidate = {
  eventClassOfferingId: string;
  classTitle: string;
  classCode: string;
  timeslotId: string | null;
  timeslotLabel: string | null;
};

export function getSeatsLeft(capacity: number | null, enrolledCount: number) {
  if (capacity === null) {
    return null;
  }

  return Math.max(capacity - enrolledCount, 0);
}

export function isOfferingFull(capacity: number | null, enrolledCount: number) {
  const seatsLeft = getSeatsLeft(capacity, enrolledCount);
  return seatsLeft !== null && seatsLeft <= 0;
}

export function findEventEnrollmentConflict(
  existingEnrollments: EnrollmentConflictCandidate[],
  targetOfferingId: string,
  targetTimeslotId: string | null,
) {
  return existingEnrollments.find(
    (enrollment) =>
      enrollment.eventClassOfferingId !== targetOfferingId &&
      (enrollment.timeslotId === null ||
        targetTimeslotId === null ||
        enrollment.timeslotId === targetTimeslotId),
  ) ?? null;
}

export function formatEnrollmentConflictMessage(conflict: EnrollmentConflictCandidate) {
  if (conflict.timeslotLabel) {
    return `Attendee is already assigned to ${conflict.classTitle} (${conflict.classCode}) during ${conflict.timeslotLabel}. Remove that enrollment before assigning another class in the same timeslot.`;
  }

  return `Attendee is already assigned to ${conflict.classTitle} (${conflict.classCode}). Remove that enrollment before assigning another class in the same timeslot.`;
}

export function buildClassAttendanceUpdate(attended: boolean, now = new Date()) {
  return {
    attendedAt: attended ? now : null,
  };
}
