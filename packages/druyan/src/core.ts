// tslint:disable: max-func-body-length
import { Task } from "@tdreyno/pretty-please";
import { Action, enter, exit, isAction } from "./action";
import { Context } from "./context";
import { __internalEffect, Effect, isEffect, log } from "./effect";
import {
  MissingCurrentState,
  StateDidNotRespondToAction,
  UnknownStateReturnType,
} from "./errors";
import { isStateTransition, StateReturn, StateTransition } from "./state";

function enterState(
  context: Context,
  targetState: StateTransition<any, any, any>,
  exitState?: StateTransition<any, any, any>,
): ExecuteResult {
  let exitEffects: Effect[] = [];
  let exitTasks: Task<any, void | StateReturn | StateReturn[]>[] = [];

  if (exitState) {
    exitEffects.push(__internalEffect("exited", exitState, Task.empty));

    try {
      const result = execute(exit(), context, exitState);

      exitEffects = exitEffects.concat(result[0]);
      exitTasks = result[1];
    } catch (e) {
      if (!(e instanceof StateDidNotRespondToAction)) {
        throw e;
      }
    }
  }

  return [
    [
      ...exitEffects,

      // Add a log effect.
      log(`Enter: ${targetState.name}`, targetState.data),

      // Add a goto effect for testing.
      __internalEffect("entered", targetState, Task.empty),
    ],

    exitTasks,
  ];
}

export interface ExecuteResult extends Array<any> {
  0: Effect[];
  1: Task<any, void | StateReturn | StateReturn[]>[];
  length: 2;
}

export function execute<A extends Action<any>>(
  action: A,
  context: Context,
  targetState = context.currentState,
  exitState = context.history.previous,
): ExecuteResult {
  if (!targetState) {
    throw new MissingCurrentState("Must provide a current state");
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
      [
        // Add a log effect.
        log(`Update: ${targetState.name}`, targetState.data),

        // Add a goto effect for testing.
        __internalEffect("update", targetState, Task.empty),
      ],

      [],
    ];
  }

  const isReentering =
    exitState &&
    exitState.name === targetState.name &&
    targetState.mode === "append" &&
    action.type === "Enter";

  const isEnteringNewState =
    !isUpdating && !isReentering && action.type === "Enter";

  const prefix: ExecuteResult = isEnteringNewState
    ? enterState(context, targetState, exitState)
    : [[], []];

  const result = targetState.executor(action);

  // State transition produced no side-effects
  if (!result) {
    if (context.allowUnhandled) {
      return [[], []];
    }

    throw new StateDidNotRespondToAction(targetState, action);
  }

  return processStateReturn(context, prefix, result);
}

export function processStateReturn(
  context: Context,
  prefix: ExecuteResult,
  result: void | StateReturn | StateReturn[],
): ExecuteResult {
  // Transion can return 1 side-effect, or an array of them.
  const results = result ? (Array.isArray(result) ? result : [result]) : [];

  return results.reduce((sum, item) => {
    const individualResult = processIndividualStateReturn(context, item);

    return [
      sum[0].concat(individualResult[0]),
      sum[1].concat(individualResult[1]),
    ];
  }, prefix);
}

function processIndividualStateReturn(
  context: Context,
  item: StateReturn,
): ExecuteResult {
  const targetState = context.currentState;

  if (isEffect(item)) {
    if (item.label === "reenter") {
      if (!(item.data as any).replaceHistory) {
        // Insert onto front of history array.
        context.history.push(targetState);
      }

      const reenter = execute(enter(), context, targetState, targetState);
      return [[item, ...reenter[0]], reenter[1]];
    }

    if (item.label === "goBack") {
      const previousState = context.history.previous!;

      // Insert onto front of history array.
      context.history.push(previousState);

      const goBack = execute(enter(), context, previousState);
      return [[item, ...goBack[0]], goBack[1]];
    }

    return [[item], []];
  }

  // If we get a state handler, transition to it.
  if (isStateTransition(item)) {
    // TODO: Make async.
    // Insert onto front of history array.
    context.history.push(item);

    return execute(enter(), context);
  }

  // If we get an action, convert to task.
  if (isAction(item)) {
    return [[], [Task.of(item)]];
  }

  // If we get a promise, convert it to a Task
  if (item instanceof Promise) {
    return [[], [Task.fromPromise(item)]];
  }

  // If we get a task, hold on to it.
  if (item instanceof Task) {
    return [[], [item]];
  }

  // Should be impossible to get here with TypeScript,
  // but could happen with plain JS.
  throw new UnknownStateReturnType(item);
}

export function runEffects(context: Context, effects: Effect[]): void {
  effects.forEach(e => e.executor(context));
}
