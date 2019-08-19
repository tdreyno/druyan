// tslint:disable: max-func-body-length
import isFunction from "lodash.isfunction";
import { Action, enter, exit, isAction } from "./action";
import { Context } from "./context";
import { __internalEffect, Effect, isEffect, log } from "./effect";
import {
  EnterExitMustBeSynchronous,
  MissingCurrentState,
  StateDidNotRespondToAction,
  UnknownStateReturnType,
} from "./errors";
import { isEventualAction } from "./eventualAction";
import {
  isStateHandlerFn,
  StateReturn,
  StateTransition,
  UpdateArgs,
} from "./state";

export async function execute<A extends Action<any>>(
  action: A,
  context: Context,
  targetState = context.currentState,
  exitState = context.history.previous,
): Promise<Effect[]> {
  if (!targetState) {
    throw new MissingCurrentState("Must provide a current state");
  }

  let prefixEffects: Effect[] = [];

  if (action.type === "Enter") {
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
  }

  const transition = targetState.executor(action);

  if (["Enter", "Exit"].includes(action.type)) {
    let isResolvedYet = false;

    if (transition instanceof Promise) {
      (transition as Promise<any>).then(() => {
        isResolvedYet = true;
      });

      // Wait one cycle to let the above process if already complete.
      await new Promise<void>(resolve => {
        setTimeout(() => resolve(), 1);
      });
    } else {
      isResolvedYet = true;
    }

    if (!isResolvedYet) {
      const msg = `${action.type} action handler on state ${targetState.name} should be synchronous.`;

      if (context.onAsyncEnterExit === "throw") {
        throw new EnterExitMustBeSynchronous(msg);
      }

      if (context.onAsyncEnterExit === "warn") {
        // tslint:disable-next-line: no-console
        console.warn(msg);
      }
    }
  }

  const result = await transition;

  // State transition produced no side-effects
  if (!result) {
    if (context.allowUnhandled) {
      return [];
    }

    throw new StateDidNotRespondToAction(targetState, action);
  }

  // Transion can return 1 side-effect, or an array of them.
  const asArray = Array.isArray(result) ? result : [result];

  // flatMap the array of side-effects and side-effect Promises
  return processStateReturns(
    action,
    context,
    (prefixEffects as StateReturn[]).concat(asArray),
  );
}

async function processStateReturns<A extends Action<any>>(
  action: A,
  context: Context,
  array: StateReturn[],
): Promise<Effect[]> {
  return array.reduce<Promise<Effect[]>>(async (sumPromise, item) => {
    const sum = await sumPromise;
    const resolvedItem = await item;
    const targetState = context.currentState;

    if (isEffect(resolvedItem)) {
      if (resolvedItem.label === "reenter") {
        if (!(resolvedItem.data as any).replaceHistory) {
          // Insert onto front of history array.
          context.history.push(targetState);
        }

        return sum.concat([
          resolvedItem,
          ...(await execute(enter(), context, targetState, targetState)),
        ]);
      }

      if (resolvedItem.label === "goBack") {
        const previousState = context.history.previous!;

        // Insert onto front of history array.
        context.history.push(previousState);

        return sum.concat([
          resolvedItem,
          ...(await execute(enter(), context, previousState)),
        ]);
      }

      if (resolvedItem.label === "update") {
        type TargetData = typeof targetState.data;
        const updateArgs = resolvedItem.data as UpdateArgs<TargetData>;

        const reboundState = targetState.boundState(
          ...(updateArgs.map((arg: any, i: number) => {
            return isFunction(arg) ? arg(targetState.data[i]) : arg;
          }) as TargetData),
        );

        return await handleState(context, sum, targetState, reboundState);
      }

      return [...sum, resolvedItem];
    }

    // "flatten" results by concatting them
    if (Array.isArray(resolvedItem)) {
      return sum.concat(
        await processStateReturns(action, context, resolvedItem),
      );
    }

    // If we get a state handler, transition to it.
    if (isStateHandlerFn(resolvedItem)) {
      return await handleState(context, sum, targetState, resolvedItem);
    }

    // If we get an action, run it.
    if (isAction(resolvedItem)) {
      // Safely mutating on purpose.
      sum.push(__internalEffect("runNextAction", resolvedItem));

      return sum;
    }

    // Eventual actions are event streams of future actions.
    if (isEventualAction(resolvedItem)) {
      resolvedItem.createdInState = context.currentState;

      // Safely mutating on purpose.
      sum.push(__internalEffect("eventualAction", resolvedItem));

      return sum;
    }

    // Should be impossible to get here with TypeScript,
    // but could happen with plain JS.
    throw new UnknownStateReturnType(
      `Action ${action.type} in State ${
        targetState.name
      } returned an known effect type: ${resolvedItem.toString()}`,
    );
  }, Promise.resolve([]));
}

async function handleState(
  context: Context,
  sum: Effect[],
  currentState: StateTransition<any, any, any>,
  resolvedItem: StateTransition<any, any, any>,
): Promise<Effect[]> {
  // If its the same state, replace it.
  if (currentState && currentState.name === resolvedItem.name) {
    // Remove old state
    context.history.pop();

    // Replace with new one
    context.history.push(resolvedItem);

    return sum;
  }

  // Insert onto front of history array.
  context.history.push(resolvedItem);

  return sum.concat(await execute(enter(), context));
}

export function runEffects(
  context: Context,
  effects: Effect[],
): Promise<Array<void | Action<any>>> {
  return effects.reduce(async (sumPromise, effect) => {
    const sum = await sumPromise;

    const result = await effect.executor(context);

    sum.push(result);

    return sum;
  }, Promise.resolve([] as Array<void | Action<any>>));
}
