CREATE TABLE "EventClassTimeslot" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventClassTimeslot_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "EventClassOffering"
ADD COLUMN     "timeslotId" TEXT,
ADD COLUMN     "locationName" TEXT,
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "EventClassPreference" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "timeslotId" TEXT NOT NULL,
    "registrationAttendeeId" TEXT NOT NULL,
    "eventClassOfferingId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventClassPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventClassTimeslot_eventId_label_key" ON "EventClassTimeslot"("eventId", "label");
CREATE INDEX "EventClassTimeslot_eventId_sortOrder_idx" ON "EventClassTimeslot"("eventId", "sortOrder");
CREATE INDEX "EventClassTimeslot_eventId_active_sortOrder_idx" ON "EventClassTimeslot"("eventId", "active", "sortOrder");

DROP INDEX "EventClassOffering_eventId_classCatalogId_key";
CREATE UNIQUE INDEX "EventClassOffering_eventId_classCatalogId_timeslotId_key" ON "EventClassOffering"("eventId", "classCatalogId", "timeslotId");
CREATE INDEX "EventClassOffering_timeslotId_active_idx" ON "EventClassOffering"("timeslotId", "active");

CREATE UNIQUE INDEX "EventClassPreference_timeslotId_registrationAttendeeId_rank_key" ON "EventClassPreference"("timeslotId", "registrationAttendeeId", "rank");
CREATE UNIQUE INDEX "EventClassPreference_timeslotId_registrationAttendeeId_eventClassOffering_key" ON "EventClassPreference"("timeslotId", "registrationAttendeeId", "eventClassOfferingId");
CREATE INDEX "EventClassPreference_eventId_timeslotId_idx" ON "EventClassPreference"("eventId", "timeslotId");
CREATE INDEX "EventClassPreference_eventClassOfferingId_rank_idx" ON "EventClassPreference"("eventClassOfferingId", "rank");
CREATE INDEX "EventClassPreference_registrationAttendeeId_timeslotId_idx" ON "EventClassPreference"("registrationAttendeeId", "timeslotId");

ALTER TABLE "RegistrationAttendee" ADD CONSTRAINT "RegistrationAttendee_id_eventRegistrationId_key" UNIQUE ("id", "eventRegistrationId");

ALTER TABLE "EventClassTimeslot" ADD CONSTRAINT "EventClassTimeslot_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventClassOffering" ADD CONSTRAINT "EventClassOffering_timeslotId_fkey" FOREIGN KEY ("timeslotId") REFERENCES "EventClassTimeslot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventClassPreference" ADD CONSTRAINT "EventClassPreference_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventClassPreference" ADD CONSTRAINT "EventClassPreference_timeslotId_fkey" FOREIGN KEY ("timeslotId") REFERENCES "EventClassTimeslot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventClassPreference" ADD CONSTRAINT "EventClassPreference_registrationAttendeeId_fkey" FOREIGN KEY ("registrationAttendeeId") REFERENCES "RegistrationAttendee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventClassPreference" ADD CONSTRAINT "EventClassPreference_eventClassOfferingId_fkey" FOREIGN KEY ("eventClassOfferingId") REFERENCES "EventClassOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
