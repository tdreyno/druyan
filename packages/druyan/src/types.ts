import { Action } from "./Action";
import { Context } from "./Context";
import { Effect } from "./effects";

export type ContextFn<C extends Context> = (
  context: C,
  runLater: (laterA: Action<any>) => void,
) => void | Effect | Effect[] | Promise<void | Effect | Effect[]>;

export function isContextFn<C extends Context>(
  fn: (...args: any[]) => any,
): fn is ContextFn<C> {
  return fn.length !== 0;
}

export type StateReturn<C extends Context> =
  | Effect
  | ContextFn<C>
  | Array<Effect | ContextFn<C> | Effect[] | Promise<Effect[]>>;

export type StateFn<A extends Action<any>, C extends Context> = (
  action: A,
  context: C,
  runLater: (laterA: Action<any>) => void,
) => StateReturn<C> | Promise<StateReturn<C>>;
