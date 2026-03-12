export type CreateEventActionState = {
  status: "idle" | "error";
  message: string | null;
};

export type UpdateEventActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

export const updateEventInitialState: UpdateEventActionState = {
  status: "idle",
  message: null,
};
