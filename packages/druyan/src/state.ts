import { createDraft, finishDraft, isDraft, setUseProxies } from "immer";
import { Action } from "./action";
import { __internalEffect, Effect } from "./effect";
import { EventualAction } from "./eventualAction";

// Revoked proxies cause too many issues.
setUseProxies(false);

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
  mode: "append" | "update";
  reenter: (...args: Data) => StateTransition<Name, A, Data>;
  executor: (
    action: A,
  ) =>
    | StateReturn
    | Promise<StateReturn>
    | StateReturn[]
    | Promise<StateReturn[]>;
}

export function isStateTransition(
  a: StateTransition<any, any, any> | unknown,
): a is StateTransition<any, any, any> {
  return a && (a as any).isStateTransition;
}

/**
 * A State function as written by the user. It accepts
 * the action to run and an arbitrary number of serializable
 * arguments.
 */
export type State<A extends Action<any>, Data extends any[]> = (
  action: A,
  ...data: Data
) => StateReturn | StateReturn[] | Promise<StateReturn | StateReturn[]>;

export interface BoundStateFn<
  Name extends string,
  A extends Action<any>,
  Data extends any[]
> {
  (...data: Data): StateTransition<Name, A, Data>;
  name: Name;
  update(...data: Data): StateTransition<Name, A, Data>;
  reenter(...data: Data): StateTransition<Name, A, Data>;
}

interface Options {
  mutable: boolean;
}

export function state<
  Name extends string,
  A extends Action<any>,
  Data extends any[]
>(
  name: Name,
  executor: State<A, Data>,
  options?: Partial<Options>,
): BoundStateFn<Name, A, Data> {
  const immutable = !options || !options.mutable;

  const fn = (...args: Data) => {
    const finishedArgs = args.map(arg => {
      if (immutable && isDraft(arg)) {
        try {
          return finishDraft(arg);
        } catch (_e) {
          return arg;
        }
      }

      return arg;
    }) as Data;

    return {
      name,
      data: finishedArgs,
      isStateTransition: true,
      mode: "append",
      reenter: (...reenterArgs: Data) => {
        const bound = fn(...reenterArgs);
        bound.mode = "append";
        return bound;
      },
      executor: (action: A) => {
        // Convert to immer drafts
        const draftArgs = immutable
          ? (finishedArgs.map(arg => {
              try {
                return createDraft(arg);
              } catch (_e) {
                return arg;
              }
            }) as Data)
          : finishedArgs;

        // Run state execturoe
        return executor(action, ...draftArgs);
      },
    };
  };

  Object.defineProperty(fn, "name", { value: name });

  fn.reenter = (...args: Data) => {
    const bound = fn(...args);
    bound.mode = "append";
    return bound;
  };

  fn.update = (...args: Data) => {
    const bound = fn(...args);
    bound.mode = "update";
    return bound;
  };

  return fn as BoundStateFn<Name, A, Data>;
}
