import { Action } from "./action";
import { Context } from "./context";
import { StateTransition } from "./state";

export interface Effect {
  label: string;
  data: any;
  isEffect: true;
  executor: (
    context: Context,
  ) =>
    | void
    | Effect
    | Effect[]
    | Action<any>
    | StateTransition<any, any, any>
    | Promise<
        void | Effect | Effect[] | Action<any> | StateTransition<any, any, any>
      >;
}

export function isEffect(e: Effect | unknown): e is Effect {
  return e && (e as any).isEffect;
}

export function isEffects(effects: unknown): effects is Effect[] {
  return Array.isArray(effects) && effects.every(isEffect);
}

const RESERVED_EFFECTS = [
  "exited",
  "entered",
  "runNextAction",
  "eventualAction",
  "reenter",
  "goBack",
  "log",
  "error",
  "warn",
  "noop",
  "update",
  "task",
];

export function effect<
  D extends any,
  F extends (
    context: Context,
  ) =>
    | void
    | Effect
    | Action<any>
    | StateTransition<any, any, any>
    | Promise<void | Effect | Action<any> | StateTransition<any, any, any>>
>(label: string, data: D, executor?: F): Effect {
  if (RESERVED_EFFECTS.includes(label)) {
    throw new Error(
      `${label} is a reserved effect label, please change the label of your custom effect`,
    );
  }

  return __internalEffect(label, data, executor);
}

export function __internalEffect<
  D extends any,
  F extends (
    context: Context,
  ) =>
    | void
    | Effect
    | Effect[]
    | Action<any>
    | StateTransition<any, any, any>
    | Promise<
        void | Effect | Effect[] | Action<any> | StateTransition<any, any, any>
      >
>(label: string, data: D, executor?: F): Effect {
  return {
    label,
    data,
    executor: executor || (() => void 0),
    isEffect: true,
  };
}

export function reenter(replaceHistory = true): Effect {
  return __internalEffect("reenter", { replaceHistory });
}

export function goBack(): Effect {
  return __internalEffect("goBack", undefined);
}

export function log(...msgs: any[]) {
  return __internalEffect("log", msgs, context => {
    if (context.customLogger) {
      context.customLogger(msgs, "log");
    } else if (!context.disableLogging) {
      // tslint:disable-next-line:no-console
      console.log(...msgs);
    }
  });
}

export function error(...msgs: any[]) {
  return __internalEffect("error", msgs, context => {
    if (context.customLogger) {
      context.customLogger(msgs, "error");
    } else if (!context.disableLogging) {
      // tslint:disable-next-line:no-console
      console.error(...msgs);
    }
  });
}

export function warn(...msgs: any[]) {
  return __internalEffect("warn", msgs, context => {
    if (context.customLogger) {
      context.customLogger(msgs, "warn");
    } else if (!context.disableLogging) {
      // tslint:disable-next-line:no-console
      console.warn(...msgs);
    }
  });
}

export function noop() {
  return __internalEffect("noop", undefined);
}

export function task<
  T extends
    | Effect
    | Effect[]
    | StateTransition<any, any, any>
    | Action<any>
    | void
>(callback: () => Promise<T>): Effect {
  return __internalEffect("task", [callback], callback);
}
