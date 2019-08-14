import { Action } from "./action";
import { Effect } from "./effect";
import { EventualAction } from "./eventualAction";

/**
 * States can return either:
 *
 * - An effect to run async
 * - An action to run async
 * - The next state to enter
 */
export type StateReturn =
  | Effect
  | Action<any>
  | StateTransition<any, any, any>
  | EventualAction<any, any>;

/**
 * State handlers are objects which contain a serializable list of bound
 * arguments and an executor function which is curried to contain those
 * args locked in. The executor can return 1 or more value StateReturn
 * value and can do so synchronously or async.
 */
export interface StateTransition<
  Name extends string,
  A extends Action<any>,
  Data extends any[]
> {
  name: Name;
  data: Data;
  isStateTransition: true;
  boundState: BoundStateFn<Name, A, Data>;
  executor: (
    action: A,
  ) =>
    | StateReturn
    | Promise<StateReturn>
    | StateReturn[]
    | Promise<StateReturn[]>;
}

export function isStateHandlerFn(
  a: StateTransition<any, any, any> | unknown,
): a is StateTransition<any, any, any> {
  return a && (a as any).isStateTransition;
}

/**
 * A State function as written by the user. It accepts
 * the action to run and an arbitrary number of serializable
 * arguments.
 */
export type State<A extends Action<any>, Data extends any[]> = (
  action: A,
  ...data: Data
) => StateReturn | StateReturn[] | Promise<StateReturn | StateReturn[]>;

export type BoundStateFn<
  Name extends string,
  A extends Action<any>,
  Data extends any[]
> = (...data: Data) => StateTransition<Name, A, Data>;

export function state<
  Name extends string,
  A extends Action<any>,
  Data extends any[]
>(name: Name, executor: State<A, Data>): BoundStateFn<Name, A, Data> {
  const fn = (...args: Data) => ({
    name,
    data: args,
    isStateTransition: true,
    executor: (action: A) => executor(action, ...args),
    boundState: fn,
  });

  Object.defineProperty(fn, "name", { value: name });

  return fn as BoundStateFn<Name, A, Data>;
}
