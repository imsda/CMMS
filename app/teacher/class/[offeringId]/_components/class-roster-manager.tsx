"use client";

import { useMemo, useState, useTransition } from "react";

import {
  signOffRequirementsForStudents,
  updateClassAttendance,
} from "../../../../actions/teacher-actions";

type StudentRow = {
  rosterMemberId: string;
  name: string;
  memberRole: string;
  attendedAt: string | null;
  alreadyCompleted: boolean;
};

type ClassRosterManagerProps = {
  offeringId: string;
  honorCode: string;
  students: StudentRow[];
};

export function ClassRosterManager({ offeringId, honorCode, students }: ClassRosterManagerProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedCount = selectedIds.length;
  const signOffEligibleCount = useMemo(
    () => students.filter((student) => !student.alreadyCompleted).length,
    [students],
  );

  function toggleSelected(rosterMemberId: string) {
    setSelectedIds((current) =>
      current.includes(rosterMemberId)
        ? current.filter((id) => id !== rosterMemberId)
        : [...current, rosterMemberId],
    );
  }

  return (
    <>
      {errorMessage ? (
        <p className="alert-danger">
          {errorMessage}
        </p>
      ) : null}

      <div className="glass-table table-shell overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Student
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Attendance
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Requirement
              </th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.rosterMemberId}>
                <td className="px-4 py-3 text-sm font-medium text-slate-800">{student.name}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{student.memberRole}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      setErrorMessage(null);
                      startTransition(async () => {
                        try {
                          await updateClassAttendance({
                            offeringId,
                            rosterMemberId: student.rosterMemberId,
                            attended: !student.attendedAt,
                          });
                        } catch (error) {
                          setErrorMessage(
                            error instanceof Error ? error.message : "Unable to update attendance.",
                          );
                        }
                      });
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      student.attendedAt
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-200 text-slate-700"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {student.attendedAt ? "Present" : "Absent"}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      disabled={student.alreadyCompleted}
                      checked={selectedIds.includes(student.rosterMemberId)}
                      onChange={() => toggleSelected(student.rosterMemberId)}
                    />
                    {student.alreadyCompleted ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        Completed
                      </span>
                    ) : (
                      `Select for ${honorCode} sign-off`
                    )}
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="glass-card flex items-center justify-between">
        <p className="text-sm text-slate-600">
          {signOffEligibleCount} student(s) still need this requirement completed.
        </p>
        <button
          type="button"
          disabled={selectedCount === 0}
          onClick={() => setModalOpen(true)}
          className="btn-primary"
        >
          Sign Off Requirements ({selectedCount})
        </button>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="glass-modal w-full max-w-xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Confirm Requirement Sign-Off</h3>
                <p className="mt-1 text-sm text-slate-600">
                  You are about to mark <strong>{honorCode}</strong> completed for {selectedCount} student(s).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="btn-ghost rounded-xl px-2 py-1 text-slate-500"
              >
                ✕
              </button>
            </div>

            <label className="mt-4 block space-y-1 text-sm font-medium text-slate-700">
              Optional Notes
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                className="textarea-glass"
                placeholder="Add notes for the completion record"
              />
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending || selectedCount === 0}
                onClick={() => {
                  setErrorMessage(null);
                  startTransition(async () => {
                    try {
                      await signOffRequirementsForStudents({
                        offeringId,
                        rosterMemberIds: selectedIds,
                        notes,
                      });
                      setSelectedIds([]);
                      setNotes("");
                      setModalOpen(false);
                    } catch (error) {
                      setErrorMessage(
                        error instanceof Error ? error.message : "Unable to sign off requirements.",
                      );
                    }
                  });
                }}
                className="btn-primary"
              >
                Confirm Sign-Off
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
