"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import {
  checkInAttendee,
  checkInAttendeeByRosterMemberId,
  markRegistrationCheckedIn,
} from "../../../../actions/checkin-actions";

type Attendee = {
  id: string;
  checkedInAt: string | Date | null;
  rosterMemberId: string;
  rosterMember: {
    firstName: string;
    lastName: string;
    memberRole: string;
    swimTestCleared: boolean;
  };
};

type Registration = {
  id: string;
  registrationCode: string;
  status: string;
  checkedInCount: number;
  hasMissingRequiredFields: boolean;
  missingRequiredFields: string[];
  club: { id: string; name: string; code: string };
  attendees: Attendee[];
};

type CheckinClientProps = {
  eventId: string;
  eventName: string;
  registrations: Registration[];
};

export function CheckinClient({ eventId, eventName, registrations }: CheckinClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOffline, setIsOffline] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanMessage, setScanMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [attendeeErrors, setAttendeeErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const videoRef = useRef<HTMLVideoElement>(null);
  const stopScanRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    setIsOffline(!navigator.onLine);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    return () => {
      stopScanRef.current?.();
    };
  }, []);

  const q = searchQuery.trim().toLowerCase();

  const filteredRegistrations = registrations
    .map((reg) => {
      if (!q) return { reg, attendees: reg.attendees };
      const clubMatches = reg.club.name.toLowerCase().includes(q);
      if (clubMatches) return { reg, attendees: reg.attendees };
      const attendees = reg.attendees.filter(
        (a) =>
          a.rosterMember.firstName.toLowerCase().includes(q) ||
          a.rosterMember.lastName.toLowerCase().includes(q),
      );
      return { reg, attendees };
    })
    .filter(({ attendees }) => attendees.length > 0 || !q);

  function handleAttendeeCheckIn(attendeeId: string) {
    const fd = new FormData();
    fd.set("eventId", eventId);
    fd.set("attendeeId", attendeeId);
    setAttendeeErrors((prev) => {
      const next = { ...prev };
      delete next[attendeeId];
      return next;
    });
    startTransition(async () => {
      try {
        await checkInAttendee(fd);
      } catch (err) {
        setAttendeeErrors((prev) => ({ ...prev, [attendeeId]: String(err) }));
      }
    });
  }

  async function handleQrResult(rosterMemberId: string) {
    setScannerOpen(false);
    stopScanRef.current?.();
    stopScanRef.current = null;
    setScanMessage(null);
    startTransition(async () => {
      try {
        await checkInAttendeeByRosterMemberId(eventId, rosterMemberId);
        setScanMessage({ type: "success", text: `QR check-in successful for member ${rosterMemberId.slice(0, 8)}…` });
      } catch (err) {
        setScanMessage({ type: "error", text: String(err) });
      }
    });
  }

  async function startQrScan() {
    setScannerOpen(true);
    setScanMessage(null);

    // Wait one tick for video element to mount
    await new Promise((resolve) => setTimeout(resolve, 80));

    const video = videoRef.current;
    if (!video) {
      setScannerOpen(false);
      return;
    }

    try {
      type BarcodeDetectorLike = new (opts: { formats: string[] }) => {
        detect(src: HTMLVideoElement): Promise<{ rawValue: string }[]>;
      };
      const windowWithBarcode = window as typeof window & { BarcodeDetector?: BarcodeDetectorLike };

      if ("BarcodeDetector" in window && typeof windowWithBarcode.BarcodeDetector !== "undefined") {
        // Native BarcodeDetector path (Chrome, Edge, Android WebView)
        const BarcodeDetectorCtor = windowWithBarcode.BarcodeDetector!;
        const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.srcObject = stream;
        await video.play();

        const intervalId = setInterval(async () => {
          try {
            const codes = await detector.detect(video);
            if (codes.length > 0 && codes[0]) {
              clearInterval(intervalId);
              stream.getTracks().forEach((t) => t.stop());
              video.srcObject = null;
              await handleQrResult(codes[0].rawValue);
            }
          } catch {
            // Frame error — continue scanning
          }
        }, 300);

        stopScanRef.current = () => {
          clearInterval(intervalId);
          stream.getTracks().forEach((t) => t.stop());
          video.srcObject = null;
        };
      } else {
        // @zxing/browser polyfill fallback (iOS Safari, Samsung Internet, Firefox)
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        const reader = new BrowserQRCodeReader();
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          video,
          (result, _err, ctrl) => {
            if (result) {
              ctrl.stop();
              handleQrResult(result.getText()).catch(() => {});
            }
          },
        );
        stopScanRef.current = () => controls.stop();
      }
    } catch (err) {
      setScanMessage({ type: "error", text: `Camera error: ${String(err)}` });
      setScannerOpen(false);
    }
  }

  function stopQrScan() {
    stopScanRef.current?.();
    stopScanRef.current = null;
    setScannerOpen(false);
  }

  const totalAttendees = registrations.reduce((sum, r) => sum + r.attendees.length, 0);
  const totalCheckedIn = registrations.reduce((sum, r) => sum + r.checkedInCount, 0);

  return (
    <div className="space-y-4">
      {/* Offline notice */}
      {isOffline && (
        <div
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900"
        >
          ⚠ You are offline. Check-in actions will fail until your connection is restored.
        </div>
      )}

      {/* Summary bar */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <p className="text-sm font-semibold text-slate-700">
          {eventName} — {totalCheckedIn} / {totalAttendees} attendees checked in
        </p>
      </div>

      {/* QR scan result */}
      {scanMessage && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-medium ${
            scanMessage.type === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-rose-300 bg-rose-50 text-rose-800"
          }`}
        >
          {scanMessage.text}
          <button
            onClick={() => setScanMessage(null)}
            className="ml-3 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search + Scan row */}
      <div className="flex gap-2">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name or club…"
          className="min-h-[48px] flex-1 rounded-xl border-2 border-slate-300 bg-white px-4 text-base placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
        />
        <button
          onClick={startQrScan}
          className="flex min-h-[48px] shrink-0 items-center gap-1.5 rounded-xl border-2 border-indigo-300 bg-indigo-50 px-4 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 active:scale-95"
        >
          <span aria-hidden>📷</span> Scan QR
        </button>
      </div>

      {/* QR Scanner modal */}
      {scannerOpen && (
        <div className="rounded-2xl border-2 border-indigo-300 bg-white p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Scan Attendee QR Code</h3>
            <button
              onClick={stopQrScan}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              Cancel
            </button>
          </div>
          <video
            ref={videoRef}
            className="w-full rounded-lg bg-black"
            style={{ maxHeight: "300px", objectFit: "cover" }}
            playsInline
            muted
          />
          <p className="mt-2 text-center text-xs text-slate-500">Point camera at an attendee QR code</p>
        </div>
      )}

      {/* Registration groups */}
      {filteredRegistrations.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No attendees match your search.
        </p>
      ) : (
        <div className="space-y-4">
          {filteredRegistrations.map(({ reg, attendees }) => {
            const allCheckedIn =
              reg.attendees.length > 0 && reg.attendees.every((a) => a.checkedInAt !== null);

            return (
              <div key={reg.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {/* Club header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">
                      {reg.club.name}{" "}
                      <span className="text-xs font-normal text-slate-500">({reg.club.code})</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {reg.checkedInCount}/{reg.attendees.length} checked in &middot; {reg.status}
                    </p>
                    {reg.hasMissingRequiredFields && (
                      <p className="text-xs font-semibold text-rose-700">
                        Missing: {reg.missingRequiredFields.join(", ")}
                      </p>
                    )}
                  </div>

                  <form action={markRegistrationCheckedIn}>
                    <input type="hidden" name="eventId" value={eventId} readOnly />
                    <input type="hidden" name="registrationId" value={reg.id} readOnly />
                    <button
                      type="submit"
                      disabled={reg.attendees.length === 0 || allCheckedIn || isPending}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300 active:scale-95"
                    >
                      {allCheckedIn ? "All Checked In ✓" : "Check In Entire Club"}
                    </button>
                  </form>
                </div>

                {/* Attendee cards */}
                <div className="divide-y divide-slate-100">
                  {attendees.map((attendee) => {
                    const checkedIn = attendee.checkedInAt !== null;
                    const errMsg = attendeeErrors[attendee.id];

                    return (
                      <div
                        key={attendee.id}
                        className={`flex min-h-[72px] items-center gap-3 px-4 py-3 ${checkedIn ? "bg-emerald-50" : ""}`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-900">
                            {attendee.rosterMember.firstName} {attendee.rosterMember.lastName}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {reg.club.name} &middot; {attendee.rosterMember.memberRole.replace(/_/g, " ")}
                            {attendee.rosterMember.swimTestCleared ? (
                              <span className="ml-1.5 inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">
                                Swim ✓
                              </span>
                            ) : null}
                          </p>
                          {checkedIn ? (
                            <p className="text-xs font-semibold text-emerald-700">✓ Checked in</p>
                          ) : (
                            <p className="text-xs text-amber-700">Not checked in</p>
                          )}
                          {errMsg && <p className="text-xs text-rose-700">{errMsg}</p>}
                        </div>

                        {checkedIn ? (
                          <span className="shrink-0 rounded-xl bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-700">
                            ✓
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAttendeeCheckIn(attendee.id)}
                            disabled={isPending}
                            className="min-h-[44px] shrink-0 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300 active:scale-95"
                          >
                            CHECK IN
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {attendees.length === 0 && (
                    <p className="px-4 py-3 text-sm text-slate-500">No attendees registered.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
