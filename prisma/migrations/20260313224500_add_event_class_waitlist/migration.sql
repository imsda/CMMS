CREATE TABLE "EventClassWaitlist" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "timeslotId" TEXT NOT NULL,
    "registrationAttendeeId" TEXT NOT NULL,
    "eventClassOfferingId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventClassWaitlist_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventClassWaitlist_timeslotId_registrationAttendeeId_key" ON "EventClassWaitlist"("timeslotId", "registrationAttendeeId");
CREATE UNIQUE INDEX "EventClassWaitlist_eventClassOfferingId_registrationAttendeeId_key" ON "EventClassWaitlist"("eventClassOfferingId", "registrationAttendeeId");
CREATE UNIQUE INDEX "EventClassWaitlist_eventClassOfferingId_position_key" ON "EventClassWaitlist"("eventClassOfferingId", "position");
CREATE INDEX "EventClassWaitlist_eventId_timeslotId_idx" ON "EventClassWaitlist"("eventId", "timeslotId");
CREATE INDEX "EventClassWaitlist_registrationAttendeeId_timeslotId_idx" ON "EventClassWaitlist"("registrationAttendeeId", "timeslotId");

ALTER TABLE "EventClassWaitlist" ADD CONSTRAINT "EventClassWaitlist_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventClassWaitlist" ADD CONSTRAINT "EventClassWaitlist_timeslotId_fkey" FOREIGN KEY ("timeslotId") REFERENCES "EventClassTimeslot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventClassWaitlist" ADD CONSTRAINT "EventClassWaitlist_registrationAttendeeId_fkey" FOREIGN KEY ("registrationAttendeeId") REFERENCES "RegistrationAttendee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventClassWaitlist" ADD CONSTRAINT "EventClassWaitlist_eventClassOfferingId_fkey" FOREIGN KEY ("eventClassOfferingId") REFERENCES "EventClassOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
