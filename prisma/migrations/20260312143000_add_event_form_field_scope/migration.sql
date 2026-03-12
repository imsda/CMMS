CREATE TYPE "FormFieldScope" AS ENUM ('GLOBAL', 'ATTENDEE');

ALTER TABLE "EventFormField"
ADD COLUMN "fieldScope" "FormFieldScope" NOT NULL DEFAULT 'GLOBAL';

UPDATE "EventFormField"
SET "fieldScope" = 'ATTENDEE'
WHERE
  "key" LIKE 'attendee\_%' ESCAPE '\'
  OR "key" LIKE 'member\_%' ESCAPE '\'
  OR COALESCE(LOWER("description"), '') LIKE '%[attendee]%'
  OR (
    jsonb_typeof("options") = 'object'
    AND (
      ("options"->>'attendeeSpecific') = 'true'
      OR ("options"->>'scope') = 'ATTENDEE'
    )
  )
  OR (
    jsonb_typeof("options") = 'array'
    AND "options" @> '["__ATTENDEE_LIST__"]'::jsonb
  );
