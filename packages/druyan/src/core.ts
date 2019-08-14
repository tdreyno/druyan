import { Action, enter, exit, isAction } from "./action";
import { Context, History } from "./context";
import { __internalEffect, Effect, isEffect, log } from "./effect";
import {
  EnterExitMustBeSynchronous,
  MissingCurrentState,
  StateDidNotRespondToAction,
} from "./errors";
import { isEventualAction } from "./eventualAction";
import { isStateHandlerFn, StateReturn, StateTransition } from "./state";

export function createInitialContext(
  history: History = [],
  options?: {
    allowUnhandled?: boolean;
    maxHistory?: number;
    onAsyncEnterExit?: "throw" | "warn" | "silent";
    disableLogging?: boolean;
  },
): Context {
  return {
    history,
    allowUnhandled: (options && options.allowUnhandled) || false,
    disableLogging: (options && options.disableLogging) || false,
    maxHistory: (options && options.maxHistory) || undefined,
    onAsyncEnterExit: (options && options.onAsyncEnterExit) || "silent",
  };
}

export function getCurrentState({
  history,
}: Context): StateTransition<any, any, any> | undefined {
  return history[0];
}

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
      exitEffects = [__internalEffect("exited", exitState)];

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
      log(`Enter: ${targetState.name}`, targetState.data),

      // Add a goto effect for testing.
      __internalEffect("entered", targetState),
    ];

    if (context.maxHistory) {
      context.history = context.history.slice(0, context.maxHistory);
    }
  }

  const transition = targetState.executor(a);

  if (["Enter", "Exit"].includes(a.type)) {
    let isResolvedYet = false;

    if (transition instanceof Promise) {
      (transition as Promise<any>).then(() => {
        isResolvedYet = true;
      });
    } else {
      isResolvedYet = true;
    }

    if (!isResolvedYet) {
      if (context.onAsyncEnterExit === "throw") {
        throw new EnterExitMustBeSynchronous(
          `${a.type} action handler should be synchronous.`,
        );
      }

      if (context.onAsyncEnterExit === "warn") {
        // tslint:disable-next-line: no-console
        console.warn(`${a.type} action handler should be synchronous.`);
      }
    }
  }

  const result = await transition;

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

        return sum.concat([
          resolvedItem,
          ...(await execute(enter(), context, targetState, targetState)),
        ]);
      }

      if (resolvedItem.label === "goBack") {
        const previousState = context.history[1];

        // Insert onto front of history array.
        context.history.unshift(previousState);

        return sum.concat([
          resolvedItem,
          ...(await execute(enter(), context, previousState)),
        ]);
      }

      return [...sum, resolvedItem];
    }

    // "flatten" results by concatting them
    if (Array.isArray(resolvedItem)) {
      return sum.concat(await processStateReturns(context, resolvedItem));
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

    // If we get an action, run it.
    if (isAction(resolvedItem)) {
      // Safely mutating on purpose.
      sum.push(__internalEffect("runNextAction", resolvedItem));

      return sum;
    }

    // Eventual actions are event streams of future actions.
    if (isEventualAction(resolvedItem)) {
      resolvedItem.createdInState = getCurrentState(context);

      // Safely mutating on purpose.
      sum.push(__internalEffect("eventualAction", resolvedItem));

      return sum;
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
