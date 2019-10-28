import { Task } from "@tdreyno/pretty-please";
import { Context } from "./context";

export interface Effect {
  label: string;
  data: any;
  isEffect: true;
  executor: (context: Context) => void;
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
  "goBack",
  "log",
  "error",
  "warn",
  "noop",
  "task",
  "timeout",
];

export function effect<D extends any, F extends (context: Context) => void>(
  label: string,
  data: D,
  executor?: F,
): Effect {
  if (RESERVED_EFFECTS.includes(label)) {
    throw new Error(
      `${label} is a reserved effect label, please change the label of your custom effect`,
    );
  }

  return __internalEffect(label, data, executor || (() => void 0));
}

export function __internalEffect<
  D extends any,
  F extends (context: Context) => void
>(label: string, data: D, executor: F): Effect {
  return {
    label,
    data,
    executor,
    isEffect: true,
  };
}

export function goBack(): Effect {
  return __internalEffect("goBack", undefined, Task.empty);
}

export function log(...msgs: any[]) {
  return __internalEffect("log", msgs, context => {
    if (context.customLogger) {
      context.customLogger(msgs, "log");
    } else if (!context.disableLogging) {
      // tslint:disable-next-line:no-console
      console.log(...msgs);
    }

    return Task.empty();
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

    return Task.empty();
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

    return Task.empty();
  });
}

export function noop() {
  return __internalEffect("noop", undefined, Task.empty);
}
