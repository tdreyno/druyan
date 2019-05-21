import { Action } from "@druyan/druyan";

export interface Reset extends Action<"Reset"> {}

export function reset(): Reset {
  return {
    type: "Reset",
  };
}
