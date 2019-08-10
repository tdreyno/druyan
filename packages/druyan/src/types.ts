export type History = Array<StateTransition<any, any, any>>;

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

export type ActionCreator<A extends Action<any>, Args extends any[]> = (
  ...args: Args
) => A;

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
  | StateTransition<any, any, any>
  | ContextEffect
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
export type State<
  _Name extends string,
  A extends Action<any>,
  Data extends any[]
> = (
  action: A,
  ...data: Data
) =>
  | StateReturn
  | Promise<StateReturn>
  | StateReturn[]
  | Promise<StateReturn[]>;

export type BoundStateFn<
  Name extends string,
  A extends Action<any>,
  Data extends any[]
> = (...data: Data) => StateTransition<Name, A, Data>;

export function wrapState<
  Name extends string,
  A extends Action<any>,
  Data extends any[]
>(executor: State<Name, A, Data>, name: Name): BoundStateFn<Name, A, Data> {
  return (...args: Data) => ({
    name,
    data: args,
    isStateTransition: true,
    executor: (action: A) => executor(action, ...args),
  });
}

type Subscriber<A extends Action<any>> = (a: A) => void;

export interface EventualAction<A extends Action<any>, Args extends any[]> {
  (...args: Args): void;
  isEventualAction: true;
  actionCreator: ActionCreator<A, Args>;
  subscribe: (sub: Subscriber<A>) => () => void;
  values: A[];
  isDead: boolean;
  destroy: () => void;
  clear: () => void;
}

export function isEventualAction(
  a: EventualAction<any, any> | unknown,
): a is EventualAction<any, any> {
  return a && (a as any).isEventualAction;
}

export function eventualAction<A extends Action<any>, Args extends any[]>(
  a: ActionCreator<A, Args>,
): EventualAction<A, Args> {
  let subscribers: Array<Subscriber<A>> = [];

  const trigger = (...args: Args) => {
    const result = a(...args);

    trigger.values.unshift(result);

    subscribers.forEach(s => s(result));
  };

  trigger.values = [] as A[];

  trigger.isEventualAction = true as true; // Force to true primitive type

  trigger.actionCreator = a;

  trigger.subscribe = (fn: Subscriber<A>) => {
    if (trigger.isDead) {
      throw new Error("Cannot subscribe to a dead eventualAction");
    }

    subscribers.push(fn);

    return () => {
      subscribers = subscribers.filter(sub => sub !== fn);
    };
  };

  trigger.isDead = false;

  trigger.destroy = () => {
    trigger.isDead = true;
    subscribers = [];

    trigger.clear();
  };

  trigger.clear = () => {
    trigger.values = [];
  };

  return trigger;
}
