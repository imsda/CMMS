import test from "node:test";
import assert from "node:assert/strict";
import { EventMode, FormFieldScope, FormFieldType } from "@prisma/client";

import {
  getTemplateCoverageSummary,
  getTemplateSectionSummaries,
} from "../lib/template-library";

test("template library summaries prefer field groups as included sections", () => {
  const snapshot = {
    eventMode: EventMode.CLUB_REGISTRATION,
    name: "Camporee",
    description: "Camporee starter",
    startsAt: "2026-10-09T18:00",
    endsAt: "2026-10-11T19:00",
    registrationOpensAt: "2026-08-15T00:00",
    registrationClosesAt: "2026-09-20T00:00",
    basePrice: 40,
    lateFeePrice: 55,
    lateFeeStartsAt: "2026-09-10T00:00",
    locationName: "Camporee Grounds",
    locationAddress: "456 Pathfinder Dr",
    dynamicFields: [
      {
        id: "group-1",
        parentFieldId: null,
        key: "club_contact",
        label: "Club Contact",
        description: "",
        type: FormFieldType.FIELD_GROUP,
        fieldScope: FormFieldScope.GLOBAL,
        isRequired: false,
        options: [],
        conditionalFieldKey: "",
        conditionalOperator: null,
        conditionalValue: "",
      },
      {
        id: "field-1",
        parentFieldId: "group-1",
        key: "contact_name",
        label: "Camporee contact name",
        description: "",
        type: FormFieldType.SHORT_TEXT,
        fieldScope: FormFieldScope.GLOBAL,
        isRequired: true,
        options: [],
        conditionalFieldKey: "",
        conditionalOperator: null,
        conditionalValue: "",
      },
      {
        id: "field-2",
        parentFieldId: "group-1",
        key: "team_interest",
        label: "Preferred activity team",
        description: "",
        type: FormFieldType.SINGLE_SELECT,
        fieldScope: FormFieldScope.ATTENDEE,
        isRequired: false,
        options: ["Drill Team"],
        conditionalFieldKey: "",
        conditionalOperator: null,
        conditionalValue: "",
      },
    ],
  };

  assert.deepEqual(getTemplateSectionSummaries(snapshot), ["Club Contact"]);
  assert.deepEqual(getTemplateCoverageSummary(snapshot), {
    sectionCount: 1,
    fieldCount: 2,
    globalFieldCount: 1,
    attendeeFieldCount: 1,
  });
});

