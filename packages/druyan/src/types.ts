import { Action } from "./Action";
import { Context } from "./Context";
import { Effect } from "./effects";

export type ContextFn<C extends Context<any>> = (
  context: C,
  runLater: (laterA: Action<any>) => void,
) => void | Effect | Effect[] | Promise<void | Effect | Effect[]>;

export function isContextFn<C extends Context<any>>(
  fn: (...args: any[]) => any,
): fn is ContextFn<C> {
  return fn.length !== 0;
}

export type StateReturn<C extends Context<any>> =
  | Effect
  | ContextFn<C>
  | Array<Effect | ContextFn<C> | Effect[] | Promise<Effect[]>>;

export type StateFn<A extends Action<any>, C extends Context<any>> = (
  action: A,
  context: C,
  runLater: (laterA: Action<any>) => void,
  ...args: any[]
) => StateReturn<C> | Promise<StateReturn<C>>;
