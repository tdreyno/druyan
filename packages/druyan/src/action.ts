export interface Action<T extends string> {
  type: T;
}

export type ActionCreator<A extends Action<any>, Args extends any[]> = (
  ...args: Args
) => A;

export function isAction<T extends string>(
  a: Action<T> | unknown,
): a is Action<T> {
  return a && (a as any).type !== undefined;
}

import { Action } from "./action";

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

// Helper for making simple actions.
export function typedAction<T extends string>(type: T): () => Action<T> {
  return () => ({
    type,
  });
}
