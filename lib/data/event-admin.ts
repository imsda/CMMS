import { EventMode, EventWorkflowType, type FormFieldType, type FormFieldScope, type Prisma } from "@prisma/client";

type DynamicFieldInput = {
  id: string;
  parentFieldId: string | null;
  key: string;
  label: string;
  description: string | null;
  type: FormFieldType;
  options: Prisma.InputJsonValue | null;
  fieldScope: FormFieldScope;
  isRequired: boolean;
  sortOrder: number;
};

export type EventMutationInput = {
  eventMode: EventMode;
  workflowType?: EventWorkflowType;
  name: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  registrationOpensAt: Date;
  registrationClosesAt: Date;
  basePrice: number;
  lateFeePrice: number;
  lateFeeStartsAt: Date;
  locationName: string | null;
  locationAddress: string | null;
  dynamicFields: DynamicFieldInput[];
};

export async function replaceEventDynamicFields(
  tx: Prisma.TransactionClient,
  eventId: string,
  dynamicFields: DynamicFieldInput[],
) {
  await tx.eventFormField.deleteMany({
    where: {
      eventId,
    },
  });

  if (dynamicFields.length === 0) {
    return;
  }

  const idMap = new Map<string, string>();

  for (const field of dynamicFields.filter((entry) => entry.parentFieldId === null)) {
    const created = await tx.eventFormField.create({
      data: {
        eventId,
        key: field.key,
        label: field.label,
        description: field.description,
        type: field.type,
        fieldScope: field.fieldScope,
        options: field.options,
        isRequired: field.isRequired,
        sortOrder: field.sortOrder,
      },
      select: {
        id: true,
      },
    });

    idMap.set(field.id, created.id);
  }

  for (const field of dynamicFields.filter((entry) => entry.parentFieldId !== null)) {
    const mappedParentId = idMap.get(field.parentFieldId as string);

    if (!mappedParentId) {
      throw new Error(`Could not resolve parent for field: ${field.key}`);
    }

    const created = await tx.eventFormField.create({
      data: {
        eventId,
        parentFieldId: mappedParentId,
        key: field.key,
        label: field.label,
        description: field.description,
        type: field.type,
        fieldScope: field.fieldScope,
        options: field.options,
        isRequired: field.isRequired,
        sortOrder: field.sortOrder,
      },
      select: {
        id: true,
      },
    });

    idMap.set(field.id, created.id);
  }
}

export async function createEventFromInput(
  tx: Prisma.TransactionClient,
  input: EventMutationInput,
  createdByUserId: string,
  slug: string,
) {
  const event = await tx.event.create({
    data: {
      name: input.name,
      eventMode: input.eventMode,
      workflowType: input.workflowType ?? EventWorkflowType.STANDARD,
      description: input.description,
      slug,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      registrationOpensAt: input.registrationOpensAt,
      registrationClosesAt: input.registrationClosesAt,
      basePrice: input.basePrice,
      lateFeePrice: input.lateFeePrice,
      lateFeeStartsAt: input.lateFeeStartsAt,
      locationName: input.locationName,
      locationAddress: input.locationAddress,
      createdByUserId,
    },
    select: {
      id: true,
    },
  });

  await replaceEventDynamicFields(tx, event.id, input.dynamicFields);

  return event;
}
