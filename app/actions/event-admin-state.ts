export type CreateEventActionState = {
  status: "idle" | "error";
  message: string | null;
};

export type UpdateEventActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

export type EventTemplateActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

export type SendEventBroadcastActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
  sentCount: number | null;
};

export const updateEventInitialState: UpdateEventActionState = {
  status: "idle",
  message: null,
};

export const sendEventBroadcastInitialState: SendEventBroadcastActionState = {
  status: "idle",
  message: null,
  sentCount: null,
};

export const eventTemplateInitialState: EventTemplateActionState = {
  status: "idle",
  message: null,
};
