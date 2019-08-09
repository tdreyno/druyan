// tslint:disable: max-classes-per-file
import { enter, exit } from "./actions";
import { log } from "./effects";
import {
  Action,
  Context,
  effect,
  Effect,
  History,
  isAction,
  isContextEffect,
  isEffect,
  isStateHandlerFn,
  StateReturn,
  StateTransition,
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

export function getCurrentState({
  history,
}: Context): StateTransition<any, any[]> | undefined {
  return history[0];
}

export class StateDidNotRespondToAction extends Error {
  constructor(
    public state: StateTransition<any, any[]>,
    public action: Action<any>,
  ) {
    super();
  }

  toString() {
    return `State "${this.state.name}" could not respond to action: ${this.action.type}`;
  }
}

export class MissingCurrentState extends Error {}

const MAX_HISTORY = 3;

export async function execute<A extends Action<any>>(
  a: A,
  context: Context,
  targetState = getCurrentState(context),
): Promise<Effect[]> {
  if (!targetState) {
    throw new MissingCurrentState("Must provide a current state");
  }

  let prefixEffects: Effect[] = [];

  if (a.type === "Enter") {
    const exiting = context.history[1];

    let exitEffects: Effect[] = [];

    if (exiting) {
      // Run exit event
      exitEffects = [effect("exited", exiting)];

      try {
        exitEffects = exitEffects.concat(
          await execute(exit(), context, exiting),
        );
      } catch (e) {
        if (!(e instanceof StateDidNotRespondToAction)) {
          throw e;
        }
      }
    }

    prefixEffects = [
      ...exitEffects,

      // Add a log effect.
      (await log(`Enter: ${targetState.name}`).executor(context)) as Effect,

      // Add a goto effect for testing.
      effect("entered", targetState),
    ];

    context.history = context.history.slice(0, MAX_HISTORY);
  }

  const result = await targetState.executor(a);

  // State transition produced no side-effects
  if (!result) {
    if (context.allowUnhandled) {
      return [];
    }

    throw new StateDidNotRespondToAction(targetState, a);
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
      // console.log("Processing effect", resolvedItem);
      // if (resolvedItem.label === "reenter") {
      //   if ((resolvedItem.data as any).replaceHistory) {
      //     context.history.shift();
      //   }

      //   return [...sum, resolvedItem, ...(await execute(enter(), context))];
      // }

      // if (resolvedItem.label === "goBack") {
      //   const previousState = context.history[1];

      //   return [
      //     ...sum,
      //     resolvedItem,
      //     ...(await execute(enter(), context, previousState)),
      //   ];
      // }

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
      // Insert onto front of history array.
      context.history.unshift(resolvedItem);

      return sum.concat(await execute(enter(), context));
    }

    // If this is an unevaluated ContextEffect
    if (isContextEffect(resolvedItem)) {
      const contextResult = await resolvedItem.executor(context);

      if (isEffect(contextResult)) {
        return [...sum, contextResult];
      }

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

export function runEffects(effects?: Effect[] | null): any[] {
  if (!effects) {
    return [];
  }

  return effects.map(({ executor }) => executor());
}
