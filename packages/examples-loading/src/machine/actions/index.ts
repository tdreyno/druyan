// Import default actions
import { ActionMap as BaseActionMap } from "@druyan/druyan";

// Import local actions
import { finishedLoading } from "./FinishedLoading";
import { startLoading } from "./StartLoading";
import { reset } from "./Reset";

// Export default actions
export { Enter, enter } from "@druyan/druyan";

// Export local actions
export * from "./StartLoading";
export * from "./FinishedLoading";
export * from "./Reset";

// Export mapping of action names to functions.
export const ActionMap = {
  ...BaseActionMap,
  startLoading,
  finishedLoading,
  reset,
};

// Valid actions
export type Actions = ReturnType<typeof ActionMap[keyof typeof ActionMap]>;
