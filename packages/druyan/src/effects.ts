import { effect, Effect } from "./types";

export function reenter(replaceHistory = true): Effect {
  return effect("reenter", { replaceHistory });
}

export function goBack(): Effect {
  return effect("goBack", undefined);
}

export function log(...msgs: any[]) {
  return effect("log", msgs, context => {
    if (context.customLogger) {
      context.customLogger(msgs, "log");
    } else {
      // tslint:disable-next-line:no-console
      console.log(...msgs);
    }
  });
}

export function error(...msgs: any[]) {
  return effect("error", msgs, context => {
    if (context.customLogger) {
      context.customLogger(msgs, "error");
    } else {
      // tslint:disable-next-line:no-console
      console.error(...msgs);
    }
  });
}

export function warn(...msgs: any[]) {
  return effect("warn", msgs, context => {
    if (context.customLogger) {
      context.customLogger(msgs, "warn");
    } else {
      // tslint:disable-next-line:no-console
      console.warn(...msgs);
    }
  });
}

export function noop() {
  return effect("noop", undefined);
}
