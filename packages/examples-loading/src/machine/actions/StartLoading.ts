import { Action } from "@druyan/druyan";

export interface StartLoading extends Action<"StartLoading"> {}

export function startLoading(): StartLoading {
  return {
    type: "StartLoading",
  };
}
