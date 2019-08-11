import { effect, Effect } from "./types";

export function update<Args extends any[]>(...args: Args): Effect {
  return effect("update", args);
}

export function reenter(replaceHistory = true): Effect {
  return effect("reenter", { replaceHistory });
}

export function goBack(): Effect {
  return effect("goBack", undefined);
}

export function log(msg: string) {
  return effect("log", msg, context => {
    if (context.customLogger) {
      context.customLogger(msg, "log");
    } else {
      // tslint:disable-next-line:no-console
      console.log(msg);
    }
  });
}

export function error(msg: string) {
  return effect("error", msg, context => {
    if (context.customLogger) {
      context.customLogger(msg, "error");
    } else {
      // tslint:disable-next-line:no-console
      console.error(msg);
    }
  });
}

export function warn(msg: string) {
  return effect("warn", msg, context => {
    if (context.customLogger) {
      context.customLogger(msg, "warn");
    } else {
      // tslint:disable-next-line:no-console
      console.warn(msg);
    }
  });
}

export function noop() {
  return effect("noop", undefined);
}
