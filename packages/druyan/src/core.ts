// tslint:disable: max-func-body-length
import { Task } from "@tdreyno/pretty-please";
import flatten from "lodash.flatten";
import { Action, enter, exit, isAction } from "./action";
import { Context } from "./context";
import { __internalEffect, Effect, isEffect, log } from "./effect";
import {
  MissingCurrentState,
  StateDidNotRespondToAction,
  UnknownStateReturnType,
} from "./errors";
import { isEventualAction } from "./eventualAction";
import { isStateTransition, StateReturn, StateTransition } from "./state";

function enteringStateEffects(
  context: Context,
  targetState: StateTransition<any, any, any>,
  exitState?: StateTransition<any, any, any>,
): Task<any, Effect[]> {
  return [
    // Add a log effect.
    log(`Enter: ${targetState.name}`, targetState.data),

    // Add a goto effect for testing.
    __internalEffect("entered", targetState),
  ]
    .andThen(effects => {
      if (!exitState) {
        return effects;
      }

      // Run exit event
      return [__internalEffect("exited", exitState), ...effects];
    })
    .andThen(exitEffects =>
      execute(exit(), context, exitState)
        .orElse(e => {
          if (!(e instanceof StateDidNotRespondToAction)) {
            return Task.fail(e);
          }

          return Task.of([]);
        })
        .map(effects => [...exitEffects, ...effects]),
    );
}

function getStateEffects<A extends Action<any>>(
  action: A,
  context: Context,
  targetState: StateTransition<any, any, any>,
): Task<StateDidNotRespondToAction | Error, Effect[]> {
  return Task.fromPromise(targetState.executor(action)).andThen(result => {
    // State transition produced no side-effects
    if (!result) {
      if (context.allowUnhandled) {
        return Task.of([] as Effect[]);
      }

      return Task.fail(new StateDidNotRespondToAction(targetState, action));
    }

    // Transion can return 1 side-effect, or an array of them.
    const asArray = Array.isArray(result) ? result : [result];

    return Task.of(asArray as Effect[]);
  });
}

export function execute<A extends Action<any>>(
  action: A,
  context: Context,
  targetState = context.currentState,
  exitState = context.history.previous,
): Task<MissingCurrentState | StateDidNotRespondToAction | Error, Effect[]> {
  if (!targetState) {
    return Task.fail(new MissingCurrentState("Must provide a current state"));
  }

  const isUpdating =
    exitState &&
    exitState.name === targetState.name &&
    targetState.mode === "update" &&
    action.type === "Enter";

  if (isUpdating) {
    // TODO: Needs to be lazy
    context.history.removePrevious();

    return [
      // Add a log effect.
      log(`Update: ${targetState.name}`, targetState.data),

      // Add a goto effect for testing.
      __internalEffect("update", targetState),
    ].andThen(Task.of);
  }

  const isReentering =
    exitState &&
    exitState.name === targetState.name &&
    targetState.mode === "append" &&
    action.type === "Enter";

  const isEnteringNewState =
    !isUpdating && !isReentering && action.type === "Enter";

  return Task.all([
    isEnteringNewState
      ? enteringStateEffects(context, targetState, exitState)
      : Task.of([]),
    getStateEffects(action, context, targetState),
  ]).andThen(([prefixEffects, asArray]) =>
    processStateReturns(action, context, [...prefixEffects, ...asArray]),
  );
}

function processStateReturn<A extends Action<any>>(
  action: A,
  context: Context,
  item: StateReturn,
): Task<UnknownStateReturnType | Error, Effect[]> {
  const targetState = context.currentState;

  if (isEffect(item)) {
    if (item.label === "reenter") {
      if (!(item.data as any).replaceHistory) {
        // Insert onto front of history array.
        context.history.push(targetState);
      }

      return execute(enter(), context, targetState, targetState).map(items => [
        item,
        ...items,
      ]);
    }

    if (item.label === "goBack") {
      const previousState = context.history.previous!;

      // Insert onto front of history array.
      context.history.push(previousState);

      return execute(enter(), context, previousState).map(items => [
        item,
        ...items,
      ]);
    }

    return [item].andThen(Task.of);
  }

  // "flatten" results by concatting them
  if (Array.isArray(item)) {
    return processStateReturns(action, context, item);
  }

  // If we get a state handler, transition to it.
  if (isStateTransition(item)) {
    // Insert onto front of history array.
    context.history.push(item);

    return execute(enter(), context);
  }

  // If we get an action, run it.
  if (isAction(item)) {
    // Safely mutating on purpose.
    return [__internalEffect("runNextAction", item)].andThen(Task.of);
  }

  // Eventual actions are event streams of future actions.
  if (isEventualAction(item)) {
    item.createdInState = context.currentState;

    // Safely mutating on purpose.
    return [__internalEffect("eventualAction", item)].andThen(Task.of);
  }

  // Should be impossible to get here with TypeScript,
  // but could happen with plain JS.
  return Task.fail(
    new UnknownStateReturnType(
      `Action ${action.type} in State ${
        targetState.name
      } returned an known effect type: ${item.toString()}`,
    ),
  );
}

function processStateReturns<A extends Action<any>>(
  action: A,
  context: Context,
  array: StateReturn[],
) {
  return array
    .map(item => processStateReturn(action, context, item))
    .andThen(Task.sequence)
    .map(flatten);
}

export function runEffects(context: Context, effects: Effect[]) {
  return effects.map(e => e.executor(context)).andThen(Task.sequence);
}
