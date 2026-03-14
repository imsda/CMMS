import test from "node:test";
import assert from "node:assert/strict";
import { EventMode, EventTemplateCategory, EventTemplateSource, FormFieldScope, FormFieldType, UserRole } from "@prisma/client";

import { createEventFromInput } from "../lib/data/event-admin";
import { buildStoredEventFieldOptions } from "../lib/event-form-config";
import { buildEventTemplateSnapshot, parseEventTemplateSnapshot } from "../lib/event-templates";
import { prisma } from "../lib/prisma";
import {
  disconnectIntegrationPrisma,
  hasIntegrationDatabase,
  resetIntegrationDatabase,
} from "./integration-helpers";

test("events created from a stored template snapshot reuse the existing event and field infrastructure", { skip: !hasIntegrationDatabase }, async () => {
  await resetIntegrationDatabase();

  const admin = await prisma.user.create({
    data: {
      email: "admin@example.org",
      name: "Admin",
      role: UserRole.SUPER_ADMIN,
    },
  });

  const templateSnapshot = buildEventTemplateSnapshot({
    eventMode: EventMode.CLASS_ASSIGNMENT,
    name: "Camporee Template",
    description: "Reusable event setup",
    startsAt: new Date("2026-04-10T12:00:00.000Z"),
    endsAt: new Date("2026-04-12T18:00:00.000Z"),
    registrationOpensAt: new Date("2026-03-01T00:00:00.000Z"),
    registrationClosesAt: new Date("2026-04-01T00:00:00.000Z"),
    basePrice: 35,
    lateFeePrice: 45,
    lateFeeStartsAt: new Date("2026-03-20T00:00:00.000Z"),
    locationName: "Camp",
    locationAddress: "123 Road",
    dynamicFields: [
      {
        id: "field-1",
        parentFieldId: null,
        key: "needs_power",
        label: "Needs power?",
        description: "",
        type: FormFieldType.SINGLE_SELECT,
        fieldScope: FormFieldScope.GLOBAL,
        isRequired: true,
        options: ["Yes", "No"],
      },
      {
        id: "field-2",
        parentFieldId: null,
        key: "power_notes",
        label: "Power notes",
        description: "",
        type: FormFieldType.LONG_TEXT,
        fieldScope: FormFieldScope.GLOBAL,
        isRequired: false,
        options: {
          conditional: {
            fieldKey: "needs_power",
            operator: "equals",
            value: "Yes",
          },
        },
      },
    ],
  });

  const template = await prisma.eventTemplate.create({
    data: {
      name: "Camporee Template",
      description: "Reusable event setup",
      eventMode: EventMode.CLASS_ASSIGNMENT,
      category: EventTemplateCategory.CLASS_ASSIGNMENT,
      source: EventTemplateSource.USER,
      isActive: true,
      snapshot: templateSnapshot,
      createdByUserId: admin.id,
    },
  });

  const parsedSnapshot = parseEventTemplateSnapshot(template.snapshot);

  await prisma.$transaction(async (tx) => {
    await createEventFromInput(
      tx,
      {
        eventMode: parsedSnapshot.eventMode,
        name: "Spring Camporee 2027",
        description: parsedSnapshot.description,
        startsAt: new Date("2027-04-09T12:00:00.000Z"),
        endsAt: new Date("2027-04-11T18:00:00.000Z"),
        registrationOpensAt: new Date("2027-03-01T00:00:00.000Z"),
        registrationClosesAt: new Date("2027-04-01T00:00:00.000Z"),
        basePrice: parsedSnapshot.basePrice,
        lateFeePrice: parsedSnapshot.lateFeePrice,
        lateFeeStartsAt: new Date("2027-03-20T00:00:00.000Z"),
        locationName: parsedSnapshot.locationName,
        locationAddress: parsedSnapshot.locationAddress,
        dynamicFields: parsedSnapshot.dynamicFields.map((field, index) => ({
          ...field,
          description: field.description || null,
          options: buildStoredEventFieldOptions({
            optionValues: field.options,
            conditional:
              field.conditionalFieldKey.length > 0 && field.conditionalOperator
                ? {
                    fieldKey: field.conditionalFieldKey,
                    operator: field.conditionalOperator,
                    value: field.conditionalValue,
                  }
                : null,
          }),
          sortOrder: index,
        })),
      },
      admin.id,
      "spring-camporee-2027",
    );
  });

  const createdEvent = await prisma.event.findUniqueOrThrow({
    where: {
      slug: "spring-camporee-2027",
    },
    include: {
      dynamicFields: {
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
  });

  assert.equal(createdEvent.name, "Spring Camporee 2027");
  assert.equal(createdEvent.eventMode, EventMode.CLASS_ASSIGNMENT);
  assert.equal(createdEvent.dynamicFields.length, 2);
  assert.equal(createdEvent.dynamicFields[0]?.key, "needs_power");
  assert.deepEqual(createdEvent.dynamicFields[0]?.options, ["Yes", "No"]);
  assert.deepEqual(createdEvent.dynamicFields[1]?.options, {
    conditional: {
      fieldKey: "needs_power",
      operator: "equals",
      value: "Yes",
    },
  });

  const refreshedTemplate = await prisma.eventTemplate.findUniqueOrThrow({
    where: {
      id: template.id,
    },
  });

  assert.equal((refreshedTemplate.snapshot as { name?: string }).name, "Camporee Template");
});

test("events created from a stored template snapshot preserve grouped child field types", { skip: !hasIntegrationDatabase }, async () => {
  await resetIntegrationDatabase();

  const admin = await prisma.user.create({
    data: {
      email: "grouped-admin@example.org",
      name: "Grouped Admin",
      role: UserRole.SUPER_ADMIN,
    },
  });

  const templateSnapshot = buildEventTemplateSnapshot({
    eventMode: EventMode.CLUB_REGISTRATION,
    name: "Grouped Template",
    description: "Grouped dynamic fields",
    startsAt: new Date("2026-04-10T12:00:00.000Z"),
    endsAt: new Date("2026-04-12T18:00:00.000Z"),
    registrationOpensAt: new Date("2026-03-01T00:00:00.000Z"),
    registrationClosesAt: new Date("2026-04-01T00:00:00.000Z"),
    basePrice: 35,
    lateFeePrice: 45,
    lateFeeStartsAt: new Date("2026-03-20T00:00:00.000Z"),
    locationName: "Camp",
    locationAddress: "123 Road",
    dynamicFields: [
      {
        id: "group-1",
        parentFieldId: null,
        key: "travel_group",
        label: "Travel Group",
        description: "",
        type: FormFieldType.FIELD_GROUP,
        fieldScope: FormFieldScope.GLOBAL,
        isRequired: false,
        options: null,
      },
      {
        id: "field-1",
        parentFieldId: "group-1",
        key: "arrival_date",
        label: "Arrival Date",
        description: "",
        type: FormFieldType.DATE,
        fieldScope: FormFieldScope.GLOBAL,
        isRequired: true,
        options: null,
      },
      {
        id: "field-2",
        parentFieldId: "group-1",
        key: "lodging_type",
        label: "Lodging Type",
        description: "",
        type: FormFieldType.SINGLE_SELECT,
        fieldScope: FormFieldScope.GLOBAL,
        isRequired: false,
        options: ["Cabin", "Tent"],
      },
      {
        id: "field-3",
        parentFieldId: "group-1",
        key: "share_roster",
        label: "Share roster",
        description: "",
        type: FormFieldType.ROSTER_MULTI_SELECT,
        fieldScope: FormFieldScope.ATTENDEE,
        isRequired: false,
        options: null,
      },
    ],
  });

  const parsedSnapshot = parseEventTemplateSnapshot(templateSnapshot);

  await prisma.$transaction(async (tx) => {
    await createEventFromInput(
      tx,
      {
        eventMode: parsedSnapshot.eventMode,
        name: "Grouped Event 2027",
        description: parsedSnapshot.description,
        startsAt: new Date("2027-04-09T12:00:00.000Z"),
        endsAt: new Date("2027-04-11T18:00:00.000Z"),
        registrationOpensAt: new Date("2027-03-01T00:00:00.000Z"),
        registrationClosesAt: new Date("2027-04-01T00:00:00.000Z"),
        basePrice: parsedSnapshot.basePrice,
        lateFeePrice: parsedSnapshot.lateFeePrice,
        lateFeeStartsAt: new Date("2027-03-20T00:00:00.000Z"),
        locationName: parsedSnapshot.locationName,
        locationAddress: parsedSnapshot.locationAddress,
        dynamicFields: parsedSnapshot.dynamicFields.map((field, index) => ({
          ...field,
          description: field.description || null,
          options: buildStoredEventFieldOptions({
            optionValues: field.options,
            conditional:
              field.conditionalFieldKey.length > 0 && field.conditionalOperator
                ? {
                    fieldKey: field.conditionalFieldKey,
                    operator: field.conditionalOperator,
                    value: field.conditionalValue,
                  }
                : null,
          }),
          sortOrder: index,
        })),
      },
      admin.id,
      "grouped-event-2027",
    );
  });

  const createdEvent = await prisma.event.findUniqueOrThrow({
    where: {
      slug: "grouped-event-2027",
    },
    include: {
      dynamicFields: {
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
  });

  assert.equal(createdEvent.dynamicFields.length, 4);

  const group = createdEvent.dynamicFields.find((field) => field.type === FormFieldType.FIELD_GROUP);
  assert.ok(group);

  const children = createdEvent.dynamicFields.filter((field) => field.parentFieldId === group.id);
  assert.deepEqual(
    children.map((field) => field.type),
    [FormFieldType.DATE, FormFieldType.SINGLE_SELECT, FormFieldType.ROSTER_MULTI_SELECT],
  );
  assert.deepEqual(children[1]?.options, ["Cabin", "Tent"]);
});

test.after(async () => {
  await disconnectIntegrationPrisma();
});
