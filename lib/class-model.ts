export const CLASS_ASSIGNMENT_POLICY = "One class enrollment per attendee per event.";

export type EnrollmentConflictCandidate = {
  eventClassOfferingId: string;
  classTitle: string;
  classCode: string;
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
) {
  return existingEnrollments.find(
    (enrollment) => enrollment.eventClassOfferingId !== targetOfferingId,
  ) ?? null;
}

export function formatEnrollmentConflictMessage(conflict: EnrollmentConflictCandidate) {
  return `Attendee is already assigned to ${conflict.classTitle} (${conflict.classCode}). Remove that enrollment before assigning another class.`;
}

export function buildClassAttendanceUpdate(attended: boolean, now = new Date()) {
  return {
    attendedAt: attended ? now : null,
  };
}
