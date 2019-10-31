import { Task } from "@tdreyno/pretty-please";
import isPlainObject from "lodash.isplainobject";
import mapValues from "lodash.mapvalues";
import { Action } from "./action";
import { __internalEffect, Effect } from "./effect";

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
  | Task<any, any>;

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
  executor: (action: A) => void | StateReturn | StateReturn[];
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
) => StateReturn | StateReturn[];

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

function cloneDeep(value: any): any {
  if (Array.isArray(value)) {
    return value.map(cloneDeep);
  }

  if (isPlainObject(value)) {
    return mapValues(value, cloneDeep);
  }

  if (value instanceof Set) {
    return new Set(cloneDeep(Array.from(value)));
  }

  if (value instanceof Map) {
    return new Map(cloneDeep(Array.from(value)));
  }

  return value;
}

export class TriggerAction {
  constructor(public action: Action<any>) {}
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

  const fn = (...data: Data) => {
    return {
      name,
      data,
      isStateTransition: true,
      mode: "append",
      reenter: (...reenterArgs: Data) => {
        const bound = fn(...reenterArgs);
        bound.mode = "append";
        return bound;
      },
      executor: (action: A) => {
        // Clones arguments
        const clonedArgs = immutable ? (data.map(cloneDeep) as Data) : data;

        // Run state execturoe
        return executor(action, ...clonedArgs);
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
