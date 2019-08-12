import { enter, exit } from "./actions";
import { log } from "./effects";
import { MissingCurrentState, StateDidNotRespondToAction } from "./errors";
import {
  Action,
  Context,
  Effect,
  effect,
  History,
  isAction,
  isEffect,
  isEventualAction,
  isStateHandlerFn,
  StateReturn,
  StateTransition,
} from "./types";

export function createInitialContext(
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
}: Context): StateTransition<any, any, any> | undefined {
  return history[0];
}

const MAX_HISTORY = 5;

export async function execute<A extends Action<any>>(
  a: A,
  context: Context,
  targetState = context.history[0],
  exitState = context.history[1],
): Promise<Effect[]> {
  if (!targetState) {
    throw new MissingCurrentState("Must provide a current state");
  }

  let prefixEffects: Effect[] = [];

  if (a.type === "Enter") {
    let exitEffects: Effect[] = [];

    if (exitState) {
      // Run exit event
      exitEffects = [effect("exited", exitState)];

      try {
        exitEffects = exitEffects.concat(
          await execute(exit(), context, exitState),
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
      log(`Enter: ${targetState.name}`),

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
      if (resolvedItem.label === "reenter") {
        const targetState = getCurrentState(context)!;

        if (!(resolvedItem.data as any).replaceHistory) {
          // Insert onto front of history array.
          context.history.unshift(targetState);
        }

        return [
          ...sum,
          resolvedItem,
          ...(await execute(enter(), context, targetState, targetState)),
        ];
      }

      if (resolvedItem.label === "goBack") {
        const previousState = context.history[1];

        // Insert onto front of history array.
        context.history.unshift(previousState);

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
      const targetState = getCurrentState(context);

      // If its the same state, replace it.
      if (targetState && targetState.name === resolvedItem.name) {
        // Remove old state
        context.history.shift();

        // Replace with new one
        context.history.unshift(resolvedItem);

        return sum;
      }

      // Insert onto front of history array.
      context.history.unshift(resolvedItem);

      return sum.concat(await execute(enter(), context));
    }

    // Eventual actions are event streams of future actions.
    if (isEventualAction(resolvedItem)) {
      resolvedItem.createdInState = getCurrentState(context);
      return [...sum, effect("eventualAction", resolvedItem)];
    }

    // Should be impossible to get here with TypeScript,
    // but could happen with plain JS.
    return sum;
  }, Promise.resolve([]));
}

export function runEffects(context: Context, effects?: Effect[] | null): any[] {
  if (!effects) {
    return [];
  }

  return effects.map(({ executor }) => executor(context));
}
