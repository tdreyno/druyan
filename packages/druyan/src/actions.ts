import { Action } from "./types";

export interface Enter extends Action<"Enter"> {}

export function enter(): Enter {
  return {
    type: "Enter",
  };
}

export interface Exit extends Action<"Exit"> {}

export function exit(): Exit {
  return {
    type: "Exit",
  };
}

export interface OnFrame extends Action<"OnFrame"> {}

export function onFrame(): OnFrame {
  return {
    type: "OnFrame",
  };
}
