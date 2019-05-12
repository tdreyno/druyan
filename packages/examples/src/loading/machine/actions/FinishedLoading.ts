import { Action } from "@druyan/druyan";

export interface FinishedLoading extends Action<"FinishedLoading"> {
  name: string;
}

export function finishedLoading(name: string): FinishedLoading {
  return {
    type: "FinishedLoading",
    name,
  };
}
