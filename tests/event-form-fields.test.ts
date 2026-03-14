import test from "node:test";
import assert from "node:assert/strict";
import { FormFieldType } from "@prisma/client";

import {
  EVENT_FORM_FIELD_TYPES,
  FIELD_GROUP_CHILD_FIELD_TYPES,
  getAllowedDynamicFieldTypes,
  typeAllowsOptions,
} from "../lib/event-form-fields";

test("field groups expose all supported child field types except FIELD_GROUP", () => {
  assert.deepEqual(FIELD_GROUP_CHILD_FIELD_TYPES, [
    FormFieldType.SHORT_TEXT,
    FormFieldType.LONG_TEXT,
    FormFieldType.DATE,
    FormFieldType.SINGLE_SELECT,
    FormFieldType.NUMBER,
    FormFieldType.MULTI_SELECT,
    FormFieldType.BOOLEAN,
    FormFieldType.ROSTER_SELECT,
    FormFieldType.ROSTER_MULTI_SELECT,
  ]);

  assert.deepEqual(getAllowedDynamicFieldTypes("group-1"), FIELD_GROUP_CHILD_FIELD_TYPES);
  assert.equal(
    (getAllowedDynamicFieldTypes("group-1") as readonly FormFieldType[]).includes(FormFieldType.FIELD_GROUP),
    false,
  );
});

test("top-level fields still allow FIELD_GROUP while preserving existing option rules", () => {
  assert.deepEqual(getAllowedDynamicFieldTypes(null), EVENT_FORM_FIELD_TYPES);
  assert.equal(
    (getAllowedDynamicFieldTypes(null) as readonly FormFieldType[]).includes(FormFieldType.FIELD_GROUP),
    true,
  );
  assert.equal(typeAllowsOptions(FormFieldType.SINGLE_SELECT), true);
  assert.equal(typeAllowsOptions(FormFieldType.MULTI_SELECT), true);
  assert.equal(typeAllowsOptions(FormFieldType.DATE), false);
});
