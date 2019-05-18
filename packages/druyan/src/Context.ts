import { Action, Enter, enter, Exit, exit } from "./Action";
import { Effect, effect, isEffect, log } from "./effects";
import { ContextFn, StateFn } from "./types";

export interface Context {
  history: string[];
  states: { [key: string]: StateFn<any, Context> };
}

export function initialContext(
  states: { [key: string]: StateFn<any, Context> },
  history: string[] = [],
): Context {
  return {
    states,
    history,
  };
}

export function currentState<C extends Context>({
  history,
  states,
}: C): StateFn<any, C> | undefined {
  const lastStateName = history[history.length - 1];
  return stateFromName(lastStateName, states);
}

function stateFromName<C extends Context>(
  name: string,
  states: { [key: string]: StateFn<any, C> },
): StateFn<any, C> | undefined {
  return states[name];
}

export class StateDidNotRespondToAction<
  A extends Action<any>,
  C extends Context
> extends Error {
  constructor(public state: StateFn<A, C>, public action: Action<any>) {
    super();
  }

  toString() {
    return `State "${this.state.name}" could not respond to action: ${
      this.action.type
    }`;
  }
}

export async function execute<A extends Action<any>, C extends Context>(
  a: A,
  fn: StateFn<A, C>,
  context: C,
  runLater: (laterA: Action<any>) => void,
  allowUnhandled = false,
): Promise<Effect[]> {
  const result = await fn(a, context, runLater);

  // State transition produced no side-effects
  if (!result) {
    if (allowUnhandled) {
      return [];
    }

    throw new StateDidNotRespondToAction<A, C>(fn, a);
  }

  // Transion can return 1 side-effect, or an array of them.
  const asArray = Array.isArray(result) ? result : [result];

  // flatMap the array of side-effects and side-effect Promises
  return asArray.reduce<Promise<Effect[]>>(async (sumPromise, item) => {
    const sum = await sumPromise;
    const resolvedItem = await item;

    // "flatten" results by concatting them
    if (Array.isArray(resolvedItem)) {
      return sum.concat(resolvedItem);
    }

    // If this is an unevaluated ContextFn
    if (!isEffect(resolvedItem)) {
      const contextResult = await resolvedItem(context, runLater);

      if (!contextResult) {
        return sum;
      }

      if (Array.isArray(contextResult)) {
        return sum.concat(contextResult);
      }

      return [...sum, contextResult];
    }

    return [...sum, resolvedItem as Effect];
  }, Promise.resolve([]));
}

export function goto<C extends Context>(
  fn: StateFn<any & Enter, any>,
): ContextFn<C> {
  // Need a function expression here to capture the function name for later.
  return async (
    context: C,
    runLater: (laterA: Action<any>) => void,
  ): Promise<Effect[]> => {
    const previousState = currentState(context);
    const maxHistory = 3;
    const lastHistoryItems = context.history
      .reverse()
      .slice(0, maxHistory)
      .reverse();
    const newHistory = [...lastHistoryItems, fn.name];

    return [
      ...(previousState
        ? await execute<Exit, C>(exit(), previousState, context, runLater, true)
        : []),

      log(`Goto: ${fn.name}`)(),

      effect("goto", fn, () => void 0),

      // Push the current state into history
      set({ history: newHistory })(context, runLater) as Effect,

      ...(await execute<Enter, C>(enter(), fn, context, runLater)),
    ];
  };
}

export function goBack<C extends Context>(states: {
  [key: string]: StateFn<any, C>;
}): ContextFn<C> {
  // Need a function expression here to capture the function name for later.
  return async (
    context: C,
    runLater: (laterA: Action<any>) => void,
  ): Promise<Effect[]> => {
    const newHistory = [...context.history];

    // Remove self from history.
    newHistory.pop();

    // Remove previous from history so we can re-enter.
    const previousName = newHistory.pop();

    if (!previousName) {
      throw new Error(
        "Could not `goBack` from " + context.history.join(" -> "),
      );
    }

    const previous = stateFromName(previousName, states);

    if (!previous) {
      throw new Error(
        "Could not `goBack` to `${previousName}` from " +
          context.history.join(" -> "),
      );
    }

    // Push the current state into history
    const setEffect = set({ history: newHistory })(context, runLater) as Effect;
    const backEffect = effect("goBack", undefined, () => void 0);
    const prefixEffects = [setEffect, backEffect];

    const result = await goto(previous)(context, runLater);

    if (result) {
      return Array.isArray(result)
        ? [...prefixEffects, ...result]
        : [...prefixEffects, result];
    } else {
      return prefixEffects;
    }
  };
}

export function set<C extends Context>(setters: Partial<C>): ContextFn<C> {
  return (context: C) => {
    // tslint:disable-next-line:no-for-in
    for (const k in setters) {
      if (setters.hasOwnProperty(k)) {
        // TODO, merge better?
        (context as any)[k] = setters[k];
      }
    }

    return effect("set", setters, () => void 0);
  };
}

export function update<C extends Context>(fn: (c: C) => void): ContextFn<C> {
  return (context: C) => {
    // Mutates
    fn(context);

    return effect("update", context, () => void 0);
  };
}

export function runEffects(effects?: Effect[] | null): any[] {
  if (!effects) {
    return [];
  }

  return effects.map(({ executor }) => executor());
}
