export type AdminCreateFormState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

export const adminCreateInitialState: AdminCreateFormState = {
  status: "idle",
  message: null,
};
