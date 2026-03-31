import { type PaymentStatus, type RegistrationStatus } from "@prisma/client";

type Props = {
  registrationStatus: RegistrationStatus | null;
  paymentStatus: PaymentStatus | null;
  reviewTurnaroundDays: number | null;
  campsiteAssignment: string | null;
};

type Step = {
  key: string;
  label: string;
};

const STEPS: Step[] = [
  { key: "DRAFT", label: "Draft" },
  { key: "SUBMITTED", label: "Submitted" },
  { key: "UNDER_REVIEW", label: "Under Review" },
  { key: "RESOLVED", label: "Approved / Revision Needed" },
];

function getStepIndex(status: RegistrationStatus | null): number {
  switch (status) {
    case "DRAFT":
    case null:
      return 0;
    case "SUBMITTED":
      return 1;
    case "REVIEWED":
      return 2;
    case "APPROVED":
    case "NEEDS_CHANGES":
    case "REJECTED":
      return 3;
    default:
      return 0;
  }
}

function isBlocked(status: RegistrationStatus | null): boolean {
  return status === "NEEDS_CHANGES" || status === "REJECTED";
}

function stepColorClass(
  stepIndex: number,
  activeIndex: number,
  blocked: boolean,
): string {
  if (stepIndex < activeIndex) {
    return "bg-emerald-500 text-white border-emerald-500";
  }
  if (stepIndex === activeIndex) {
    if (blocked && stepIndex === 3) {
      return "bg-rose-500 text-white border-rose-500";
    }
    return "bg-indigo-600 text-white border-indigo-600";
  }
  return "bg-white text-slate-400 border-slate-300";
}

function connectorColorClass(stepIndex: number, activeIndex: number): string {
  // connector between step stepIndex and stepIndex+1
  return stepIndex < activeIndex ? "bg-emerald-400" : "bg-slate-200";
}

function labelColorClass(stepIndex: number, activeIndex: number, blocked: boolean): string {
  if (stepIndex < activeIndex) return "text-emerald-700 font-medium";
  if (stepIndex === activeIndex) {
    if (blocked && stepIndex === 3) return "text-rose-700 font-semibold";
    return "text-indigo-700 font-semibold";
  }
  return "text-slate-400";
}

function getGuidanceMessage(
  status: RegistrationStatus | null,
  paymentStatus: PaymentStatus | null,
  reviewTurnaroundDays: number | null,
  campsiteAssignment: string | null,
): string | null {
  const turnaround = reviewTurnaroundDays ?? 5;

  switch (status) {
    case null:
    case "DRAFT":
      return "Complete all sections and submit when ready.";
    case "SUBMITTED":
      return `Your registration is under review. You'll receive an email when approved. Typical turnaround: ${turnaround} business day${turnaround === 1 ? "" : "s"}.`;
    case "REVIEWED":
      return "Your registration has been reviewed and is awaiting a final decision.";
    case "NEEDS_CHANGES":
      return "See reviewer notes below. Make changes and resubmit.";
    case "REJECTED":
      return "Your registration was not approved. Please contact the event organizer for more information.";
    case "APPROVED": {
      const paymentLabel =
        paymentStatus === "PAID"
          ? "Payment confirmed."
          : "Payment not yet received.";
      const campsiteLabel =
        campsiteAssignment ? `Campsite: ${campsiteAssignment}.` : null;
      return [paymentLabel, campsiteLabel].filter(Boolean).join(" ");
    }
    default:
      return null;
  }
}

function getGuidanceTone(status: RegistrationStatus | null): string {
  switch (status) {
    case "NEEDS_CHANGES":
    case "REJECTED":
      return "border-rose-200 bg-rose-50 text-rose-800";
    case "APPROVED":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "SUBMITTED":
    case "REVIEWED":
      return "border-indigo-200 bg-indigo-50 text-indigo-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

export function RegistrationStatusBanner({
  registrationStatus,
  paymentStatus,
  reviewTurnaroundDays,
  campsiteAssignment,
}: Props) {
  const activeIndex = getStepIndex(registrationStatus);
  const blocked = isBlocked(registrationStatus);
  const guidance = getGuidanceMessage(
    registrationStatus,
    paymentStatus,
    reviewTurnaroundDays,
    campsiteAssignment,
  );
  const guidanceTone = getGuidanceTone(registrationStatus);

  return (
    <article className="glass-panel space-y-4">
      {/* Step pipeline */}
      <nav aria-label="Registration status pipeline">
        <ol className="flex items-center gap-0">
          {STEPS.map((step, index) => (
            <li key={step.key} className="flex flex-1 items-center">
              {/* Step circle + label */}
              <div className="flex flex-col items-center gap-1 min-w-0">
                <div
                  className={[
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
                    stepColorClass(index, activeIndex, blocked),
                  ].join(" ")}
                  aria-current={index === activeIndex ? "step" : undefined}
                >
                  {index < activeIndex ? (
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <span
                  className={[
                    "text-center text-xs leading-tight",
                    labelColorClass(index, activeIndex, blocked),
                  ].join(" ")}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector */}
              {index < STEPS.length - 1 && (
                <div
                  className={[
                    "mb-5 h-0.5 flex-1 mx-1 transition-colors",
                    connectorColorClass(index, activeIndex),
                  ].join(" ")}
                  aria-hidden="true"
                />
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* Contextual guidance */}
      {guidance ? (
        <p
          className={[
            "rounded-lg border px-4 py-3 text-sm",
            guidanceTone,
          ].join(" ")}
        >
          {guidance}
        </p>
      ) : null}
    </article>
  );
}
