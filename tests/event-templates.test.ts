import test from "node:test";
import assert from "node:assert/strict";
import { EventMode, EventTemplateCategory, EventTemplateSource, FormFieldScope, FormFieldType } from "@prisma/client";

import {
  buildEventTemplateSnapshot,
  parseEventTemplateSnapshot,
  serializeEventTemplateDraft,
} from "../lib/event-templates";

test("event template snapshot preserves event defaults and dynamic fields", () => {
  const snapshot = buildEventTemplateSnapshot({
    eventMode: EventMode.CLUB_REGISTRATION,
    name: "Camporee Template",
    description: "Reusable camporee setup",
    startsAt: new Date("2026-04-10T12:00:00.000Z"),
    endsAt: new Date("2026-04-12T18:00:00.000Z"),
    registrationOpensAt: new Date("2026-03-01T00:00:00.000Z"),
    registrationClosesAt: new Date("2026-04-01T00:00:00.000Z"),
    basePrice: 35,
    lateFeePrice: 45,
    lateFeeStartsAt: new Date("2026-03-20T00:00:00.000Z"),
    locationName: "Indian Creek Camp",
    locationAddress: "123 Camp Rd",
    dynamicFields: [
      {
        id: "field-1",
        parentFieldId: null,
        key: "club_note",
        label: "Club Note",
        description: "Optional note",
        type: FormFieldType.SHORT_TEXT,
        fieldScope: FormFieldScope.GLOBAL,
        isRequired: true,
        options: null,
      },
    ],
  });

  assert.equal(snapshot.name, "Camporee Template");
  assert.equal(snapshot.eventMode, EventMode.CLUB_REGISTRATION);
  assert.equal(snapshot.basePrice, 35);
  assert.equal(snapshot.dynamicFields.length, 1);
  assert.deepEqual(snapshot.dynamicFields[0], {
    id: "field-1",
    parentFieldId: null,
    key: "club_note",
    label: "Club Note",
    description: "Optional note",
    type: FormFieldType.SHORT_TEXT,
    fieldScope: FormFieldScope.GLOBAL,
    isRequired: true,
    options: [],
    conditionalFieldKey: "",
    conditionalOperator: null,
    conditionalValue: "",
  });
});

test("event template snapshot preserves conditional registration logic for sectioned flows", () => {
  const snapshot = buildEventTemplateSnapshot({
    eventMode: EventMode.CLASS_ASSIGNMENT,
    name: "Camporee Modules",
    description: "Template-driven camporee workflow",
    startsAt: new Date("2026-04-10T12:00:00.000Z"),
    endsAt: new Date("2026-04-12T18:00:00.000Z"),
    registrationOpensAt: new Date("2026-03-01T00:00:00.000Z"),
    registrationClosesAt: new Date("2026-04-01T00:00:00.000Z"),
    basePrice: 35,
    lateFeePrice: 45,
    lateFeeStartsAt: new Date("2026-03-20T00:00:00.000Z"),
    locationName: "Indian Creek Camp",
    locationAddress: "123 Camp Rd",
    dynamicFields: [
      {
        id: "field-1",
        parentFieldId: null,
        key: "needs_power",
        label: "Needs power?",
        description: null,
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
        description: null,
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

  assert.equal(snapshot.dynamicFields[1]?.conditionalFieldKey, "needs_power");
  assert.equal(snapshot.dynamicFields[1]?.conditionalOperator, "equals");
  assert.equal(snapshot.dynamicFields[1]?.conditionalValue, "Yes");
});

test("event template snapshot parsing validates stored template payloads", () => {
  const parsed = parseEventTemplateSnapshot({
    eventMode: EventMode.BASIC_FORM,
    name: "Template A",
    description: "",
    startsAt: "2026-04-10T12:00",
    endsAt: "2026-04-12T18:00",
    registrationOpensAt: "2026-03-01T00:00",
    registrationClosesAt: "2026-04-01T00:00",
    basePrice: 20,
    lateFeePrice: 30,
    lateFeeStartsAt: "2026-03-20T00:00",
    locationName: "Camp",
    locationAddress: "123 Road",
    dynamicFields: [
      {
        id: "field-1",
        parentFieldId: null,
        key: "club_note",
        label: "Club Note",
        description: "",
        type: FormFieldType.SHORT_TEXT,
        fieldScope: FormFieldScope.GLOBAL,
        isRequired: true,
        options: [],
        conditionalFieldKey: "",
        conditionalOperator: null,
        conditionalValue: "",
      },
    ],
  });

  assert.equal(parsed.name, "Template A");
  assert.equal(parsed.eventMode, EventMode.BASIC_FORM);
  assert.equal(parsed.dynamicFields[0]?.type, FormFieldType.SHORT_TEXT);
});

test("event template drafts serialize persisted template rows for the create wizard", () => {
  const draft = serializeEventTemplateDraft({
    id: "template-1",
    templateKey: null,
    name: "Template A",
    description: "Shared setup",
    eventMode: EventMode.CLUB_REGISTRATION,
    category: EventTemplateCategory.BASIC_EVENTS,
    source: EventTemplateSource.USER,
    isActive: true,
    archivedAt: null,
    updatedAt: new Date("2026-03-13T09:00:00.000Z"),
    snapshot: {
      eventMode: EventMode.CLUB_REGISTRATION,
      name: "Event Defaults",
      description: "",
      startsAt: "2026-04-10T12:00",
      endsAt: "2026-04-12T18:00",
      registrationOpensAt: "2026-03-01T00:00",
      registrationClosesAt: "2026-04-01T00:00",
      basePrice: 20,
      lateFeePrice: 30,
      lateFeeStartsAt: "2026-03-20T00:00",
      locationName: "Camp",
      locationAddress: "123 Road",
      dynamicFields: [],
    },
  });

  assert.equal(draft.id, "template-1");
  assert.equal(draft.isActive, true);
  assert.equal(draft.snapshot.eventMode, EventMode.CLUB_REGISTRATION);
  assert.equal(draft.category, EventTemplateCategory.BASIC_EVENTS);
  assert.equal(draft.source, EventTemplateSource.USER);
  assert.equal(draft.snapshot.name, "Event Defaults");
});
