import { Action } from "@druyan/druyan";

export interface ReEnter extends Action<"ReEnter"> {
  result: string;
}

export function reEnter(result: string): ReEnter {
  return {
    type: "ReEnter",
    result,
  };
}
