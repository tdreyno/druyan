export interface Action<T extends string> {
  type: T;
}

export function isAction<T extends string>(a: Action<T> | any): a is Action<T> {
  return a && a.type !== undefined;
}

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

export type Actions = Enter | Exit;

export const ActionMap = {
  enter,
  exit,
};
