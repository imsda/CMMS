import { RegistrationStatus } from "@prisma/client";

type RegistrationLifecycleInput = {
  registrationOpensAt: Date;
  registrationClosesAt: Date;
  registrationStatus: RegistrationStatus | null;
  now?: Date;
};

export type RegistrationLifecycleState = {
  registrationWindowStatus: "NOT_OPEN" | "OPEN" | "CLOSED";
  canEdit: boolean;
  isLocked: boolean;
  message: string | null;
};

function getRegistrationWindowStatus(
  registrationOpensAt: Date,
  registrationClosesAt: Date,
  now: Date,
): RegistrationLifecycleState["registrationWindowStatus"] {
  if (now < registrationOpensAt) {
    return "NOT_OPEN";
  }

  if (now > registrationClosesAt) {
    return "CLOSED";
  }

  return "OPEN";
}

export function getRegistrationLifecycleState({
  registrationOpensAt,
  registrationClosesAt,
  registrationStatus,
  now = new Date(),
}: RegistrationLifecycleInput): RegistrationLifecycleState {
  const registrationWindowStatus = getRegistrationWindowStatus(
    registrationOpensAt,
    registrationClosesAt,
    now,
  );
  const isLocked =
    registrationStatus === RegistrationStatus.SUBMITTED ||
    registrationStatus === RegistrationStatus.REVIEWED ||
    registrationStatus === RegistrationStatus.APPROVED;

  if (isLocked) {
    return {
      registrationWindowStatus,
      canEdit: false,
      isLocked: true,
      message: "This registration is locked and can no longer be edited.",
    };
  }

  if (registrationWindowStatus === "NOT_OPEN") {
    return {
      registrationWindowStatus,
      canEdit: false,
      isLocked: false,
      message: "Registration has not opened yet for this event.",
    };
  }

  if (registrationWindowStatus === "CLOSED") {
    return {
      registrationWindowStatus,
      canEdit: false,
      isLocked: false,
      message: "Registration is closed for this event.",
    };
  }

  return {
    registrationWindowStatus,
    canEdit: true,
    isLocked: false,
    message: null,
  };
}

export function assertRegistrationCanPersist(input: RegistrationLifecycleInput) {
  const state = getRegistrationLifecycleState(input);

  if (!state.canEdit) {
    throw new Error(state.message ?? "Registration cannot be edited right now.");
  }
}

export function assertRegistrationCanBeCheckedIn(registrationStatus: RegistrationStatus) {
  if (registrationStatus !== RegistrationStatus.SUBMITTED) {
    throw new Error("Only submitted registrations can be approved during check-in.");
  }
}
