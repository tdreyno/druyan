import { enter, exit } from "./actions";
import { log } from "./effects";
import {
  Action,
  Context,
  effect,
  Effect,
  History,
  isAction,
  isContextFn,
  isEffect,
  isStateHandlerFn,
  StateHandlerFn,
  StateReturn,
} from "./types";

export function initialContext(
  history: History = [],
  allowUnhandled = false,
): Context {
  return {
    history,
    allowUnhandled,
  };
}

export function currentState({ history }: Context) {
  return history[history.length - 1];
}

export class StateDidNotRespondToAction extends Error {
  constructor(
    public state: StateHandlerFn<any, any>,
    public action: Action<any>,
  ) {
    super();
  }

  toString() {
    return `State "${this.state.name}" could not respond to action: ${this.action.type}`;
  }
}

const MAX_HISTORY = 3;

export async function execute<A extends Action<any>>(
  a: A,
  context: Context,
  state: StateHandlerFn<any, any> = currentState(context),
): Promise<Effect[]> {
  let prefixEffects: Effect[] = [];

  if (a.type === "Enter") {
    // Add a log effect.
    prefixEffects = [
      // Run exit event
      ...(await execute(exit(), { ...context, allowUnhandled: true })),

      // Add a log effect.
      await log(`Enter: ${state.name}`).executor(context),

      // Add a goto effect for testing.
      effect("goto", state, () => void 0),
    ];

    context.history = context.history
      .reverse()
      .slice(0, MAX_HISTORY)
      .reverse();
  }

  const result = await state.executor(a);

  // State transition produced no side-effects
  if (!result) {
    if (context.allowUnhandled) {
      return [];
    }

    throw new StateDidNotRespondToAction(state, a);
  }

  // Transion can return 1 side-effect, or an array of them.
  const asArray = Array.isArray(result) ? result : [result];

  // flatMap the array of side-effects and side-effect Promises
  return processStateReturns(
    context,
    (prefixEffects as StateReturn[]).concat(asArray),
  );
}

async function processStateReturns(
  context: Context,
  array: StateReturn[],
): Promise<Effect[]> {
  return array.reduce<Promise<Effect[]>>(async (sumPromise, item) => {
    const sum = await sumPromise;
    const resolvedItem = await item;

    if (isEffect(resolvedItem)) {
      if (resolvedItem.label === "reenter") {
        if ((resolvedItem.data as any).replaceHistory) {
          context.history.pop();
        }

        return [...sum, resolvedItem, ...(await execute(enter(), context))];
      }

      if (resolvedItem.label === "goBack") {
        const previousState = context.history[context.history.length - 2];

        return [
          ...sum,
          resolvedItem,
          ...(await execute(enter(), context, previousState)),
        ];
      }

      return [...sum, resolvedItem];
    }

    // "flatten" results by concatting them
    if (Array.isArray(resolvedItem)) {
      return sum.concat(await processStateReturns(context, resolvedItem));
    }

    // If we get an action, run it.
    if (isAction(resolvedItem)) {
      return sum.concat(await execute(resolvedItem, context));
    }

    // If we get a state handler, transition to it.
    if (isStateHandlerFn(resolvedItem)) {
      return sum.concat(await execute(enter(), context));
    }

    // If this is an unevaluated ContextFn
    if (isContextFn(resolvedItem)) {
      const contextResult = await resolvedItem.executor(context);

      if (isAction(contextResult)) {
        return sum.concat(await execute(contextResult, context));
      }

      return sum;
    }

    // Should be impossible to get here with TypeScript,
    // but could happen with plain JS.
    return sum;
  }, Promise.resolve([]));
}

// export function goBack<C extends Context<any>>(): ContextFn<C> {
//   return async (
//     context: C,
//     runLater: (laterA: Action<any>) => void,
//   ): Promise<Effect[]> => {
//     const newHistory = [...context.history];

//     // Remove self from history.
//     newHistory.pop();

//     // Remove previous from history so we can re-enter.
//     const previousName = newHistory.pop();

//     if (!previousName) {
//       throw new Error(
//         "Could not `goBack` from " + context.history.join(" -> "),
//       );
//     }

//     const previous = stateFromName(previousName, context.states);

//     if (!previous) {
//       throw new Error(
//         "Could not `goBack` to `${previousName}` from " +
//           context.history.join(" -> "),
//       );
//     }

//     // Push the current state into history
//     const setEffect = set({ history: newHistory })(context, runLater) as Effect;
//     const backEffect = effect("goBack", undefined, () => void 0);
//     const prefixEffects = [setEffect, backEffect];

//     const result = await goto(previous)(context, runLater);

//     if (result) {
//       return Array.isArray(result)
//         ? [...prefixEffects, ...result]
//         : [...prefixEffects, result];
//     } else {
//       return prefixEffects;
//     }
//   };
// }

export function runEffects(effects?: Effect[] | null): any[] {
  if (!effects) {
    return [];
  }

  return effects.map(({ executor }) => executor());
}
