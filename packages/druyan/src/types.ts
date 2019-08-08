import { noop } from "./effects";

export type History = Array<StateHandlerFn<any, any[]>>;

export interface Context {
  history: History;
  allowUnhandled?: boolean;
  customLogger?: (msg: any) => void;
}

export interface Effect {
  label: string;
  data: any;
  isEffect: true;
  executor: () => void | Action<any> | Promise<void> | Promise<Action<any>>;
}

export function isEffect(e: Effect | unknown): e is Effect {
  return e && (e as any).isEffect;
}

export function effect<
  D extends any,
  F extends () => void | Action<any> | Promise<void> | Promise<Action<any>>
>(label: string, data: D, executor: F): Effect {
  return {
    label,
    data,
    executor,
    isEffect: true,
  };
}

export type ContextFnExecutor = (context: Context) => Effect | Promise<Effect>;

export interface ContextFn {
  isContextFn: true;
  label: string;
  data: any;
  executor: ContextFnExecutor;
}

export function contextEffect(
  label: string,
  data: any,
  executor: (context: Context) => void | Effect | Promise<void | Effect>,
): ContextFn {
  return {
    isContextFn: true,
    label,
    data,
    executor: async (context: Context): Promise<Effect> => {
      const result = await executor(context);

      return result ? result : noop();
    },
  };
}

export function isContextFn(e: ContextFn | unknown): e is ContextFn {
  return e && (e as any).isContextFn;
}

export interface Action<T extends string> {
  type: T;
}

export function isAction<T extends string>(
  a: Action<T> | unknown,
): a is Action<T> {
  return a && (a as any).type !== undefined;
}

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
  | StateHandlerFn<any, any>
  | ContextFn;

/**
 * State handlers are objects which contain a serializable list of bound
 * arguments and an executor function which is curried to contain those
 * args locked in. The executor can return 1 or more value StateReturn
 * value and can do so synchronously or async.
 */
export interface StateHandlerFn<A extends Action<any>, Args extends any[]> {
  name: string;
  args: Args;
  isStateHandlerFn: true;
  executor: (
    action: A,
  ) =>
    | StateReturn
    | Promise<StateReturn>
    | StateReturn[]
    | Promise<StateReturn[]>;
}

export function isStateHandlerFn(
  a: StateHandlerFn<any, any> | any,
): a is StateHandlerFn<any, any> {
  return a && a.isStateHandlerFn;
}

/**
 * A State function as written by the user. It accepts
 * the action to run and an arbitrary number of serializable
 * arguments.
 */
export type StateFn<A extends Action<any>, Args extends any[]> = (
  action: A,
  ...args: Args
) =>
  | StateReturn
  | Promise<StateReturn>
  | StateReturn[]
  | Promise<StateReturn[]>;

export type BoundStateFn<A extends Action<any>, Args extends any[]> = (
  ...args: Args
) => StateHandlerFn<A, Args>;

// TODO: Serialize args
export function wrapState<A extends Action<any>, Args extends any[]>(
  executor: StateFn<A, Args>,
  name = executor.name,
): BoundStateFn<A, Args> {
  return (...args: Args) => ({
    name,
    args,
    isStateHandlerFn: true,
    executor: (action: A) => executor(action, ...args),
  });
}
