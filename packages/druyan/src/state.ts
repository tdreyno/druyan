import { createDraft, finishDraft, isDraft } from "immer";
import { Action } from "./action";
import { __internalEffect, Effect } from "./effect";
import { EventualAction } from "./eventualAction";

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
  boundState: BoundStateFn<Name, A, Data>;
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

export type UpdateArgs<Args extends any[]> = {
  [Arg in keyof Args]: Args[Arg] | ((arg: Args[Arg]) => Args[Arg]);
};

export interface BoundStateFn<
  Name extends string,
  A extends Action<any>,
  Data extends any[]
> {
  (...data: Data): StateTransition<Name, A, Data>;
  name: Name;
  update(...updateData: UpdateArgs<Data>): Effect;
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
        return finishDraft(arg);
      }

      return arg;
    }) as Data;

    return {
      name,
      data: finishedArgs,
      isStateTransition: true,
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
      boundState: fn,
    };
  };

  Object.defineProperty(fn, "name", { value: name });

  fn.update = (...updateArgs: UpdateArgs<Data>): Effect => {
    const finishedUpdateArgs = updateArgs.map(arg => {
      if (immutable && isDraft(arg)) {
        return finishDraft(arg);
      }

      return arg;
    }) as UpdateArgs<Data>;

    return __internalEffect("update", finishedUpdateArgs);
  };

  return fn as BoundStateFn<Name, A, Data>;
}
