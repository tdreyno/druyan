export type History = Array<StateTransition<any, any[]>>;

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
>(label: string, data: D, executor?: F): Effect {
  return {
    label,
    data,
    executor: executor || (() => void 0),
    isEffect: true,
  };
}

export type ContextEffectExecutor = (
  context: Context,
) => Effect | Promise<Effect> | Action<any> | Promise<Action<any>>;

export interface ContextEffect {
  isContextEffect: true;
  label: string;
  data: any;
  executor: ContextEffectExecutor;
}

export function contextEffect(
  label: string,
  data: any,
  executor: ContextEffectExecutor,
): ContextEffect {
  return {
    isContextEffect: true,
    label,
    data,
    executor,
  };
}

export function isContextEffect(
  e: ContextEffect | unknown,
): e is ContextEffect {
  return e && (e as any).isContextEffect;
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
  | StateTransition<any, any[]>
  | ContextEffect;

/**
 * State handlers are objects which contain a serializable list of bound
 * arguments and an executor function which is curried to contain those
 * args locked in. The executor can return 1 or more value StateReturn
 * value and can do so synchronously or async.
 */
export interface StateTransition<A extends Action<any>, Args extends any[]> {
  name: string;
  args: Args;
  isStateTransition: true;
  executor: (
    action: A,
  ) =>
    | StateReturn
    | Promise<StateReturn>
    | StateReturn[]
    | Promise<StateReturn[]>;
}

export function isStateHandlerFn(
  a: StateTransition<any, any[]> | unknown,
): a is StateTransition<any, any[]> {
  return a && (a as any).isStateTransition;
}

/**
 * A State function as written by the user. It accepts
 * the action to run and an arbitrary number of serializable
 * arguments.
 */
export type State<A extends Action<any>, Args extends any[]> = (
  action: A,
  ...args: Args
) =>
  | StateReturn
  | Promise<StateReturn>
  | StateReturn[]
  | Promise<StateReturn[]>;

export type BoundStateFn<A extends Action<any>, Args extends any[]> = (
  ...args: Args
) => StateTransition<A, Args>;

// TODO: Serialize args
export function wrapState<A extends Action<any>, Args extends any[]>(
  executor: State<A, Args>,
  name = executor.name,
): BoundStateFn<A, Args> {
  return (...args: Args) => ({
    name,
    args,
    isStateTransition: true,
    executor: (action: A) => executor(action, ...args),
  });
}
