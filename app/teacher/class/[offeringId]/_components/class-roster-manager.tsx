"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  bulkUpdateClassAttendance,
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
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "present" | "absent" | "completed" | "pending">("all");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedCount = selectedIds.length;
  const signOffEligibleCount = useMemo(
    () => students.filter((student) => !student.alreadyCompleted).length,
    [students],
  );

  const visibleStudents = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return students.filter((student) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        student.name.toLowerCase().includes(normalizedSearch) ||
        student.memberRole.toLowerCase().includes(normalizedSearch);

      const matchesFilter =
        filter === "all" ||
        (filter === "present" && student.attendedAt !== null) ||
        (filter === "absent" && student.attendedAt === null) ||
        (filter === "completed" && student.alreadyCompleted) ||
        (filter === "pending" && !student.alreadyCompleted);

      return matchesSearch && matchesFilter;
    });
  }, [filter, search, students]);

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
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            placeholder="Search students"
            className="min-w-[220px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={filter}
            onChange={(event) => setFilter(event.currentTarget.value as typeof filter)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">All students</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending sign-off</option>
          </select>
          <button
            type="button"
            onClick={() => {
              const visibleIds = visibleStudents.map((student) => student.rosterMemberId);
              const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
              setSelectedIds((current) =>
                allVisibleSelected
                  ? current.filter((id) => !visibleIds.includes(id))
                  : Array.from(new Set([...current, ...visibleIds])),
              );
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
          >
            Select visible
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Student
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Role
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Attendance
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Requirement
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleStudents.map((student) => (
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
                          router.refresh();
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
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={() => {
              setErrorMessage(null);
              startTransition(async () => {
                try {
                  await bulkUpdateClassAttendance({
                    offeringId,
                    rosterMemberIds: selectedIds,
                    attended: true,
                  });
                  router.refresh();
                } catch (error) {
                  setErrorMessage(error instanceof Error ? error.message : "Unable to mark attendance.");
                }
              });
            }}
            className="btn-secondary"
          >
            Mark Selected Present
          </button>
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={() => {
              setErrorMessage(null);
              startTransition(async () => {
                try {
                  await bulkUpdateClassAttendance({
                    offeringId,
                    rosterMemberIds: selectedIds,
                    attended: false,
                  });
                  router.refresh();
                } catch (error) {
                  setErrorMessage(error instanceof Error ? error.message : "Unable to clear attendance.");
                }
              });
            }}
            className="btn-secondary"
          >
            Mark Selected Absent
          </button>
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={() => setModalOpen(true)}
            className="btn-primary"
          >
            Sign Off Requirements ({selectedCount})
          </button>
        </div>
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
                      router.refresh();
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
