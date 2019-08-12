import { __internalEffect, Effect } from "./types";

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
    } else {
      // tslint:disable-next-line:no-console
      console.log(...msgs);
    }
  });
}

export function error(...msgs: any[]) {
  return __internalEffect("error", msgs, context => {
    if (context.customLogger) {
      context.customLogger(msgs, "error");
    } else {
      // tslint:disable-next-line:no-console
      console.error(...msgs);
    }
  });
}

export function warn(...msgs: any[]) {
  return __internalEffect("warn", msgs, context => {
    if (context.customLogger) {
      context.customLogger(msgs, "warn");
    } else {
      // tslint:disable-next-line:no-console
      console.warn(...msgs);
    }
  });
}

export function noop() {
  return __internalEffect("noop", undefined);
}
