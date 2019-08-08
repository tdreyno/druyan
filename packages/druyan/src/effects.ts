import { contextEffect, effect, Effect } from "./types";

export function reenter(replaceHistory = true): Effect {
  return effect("reenter", { replaceHistory }, () => void 0);
}

export function goBack(): Effect {
  return effect("goBack", undefined, () => void 0);
}

export function log(msg: string) {
  return contextEffect("log", msg, context => {
    if (context.customLogger) {
      context.customLogger(msg);
    } else {
      // tslint:disable-next-line:no-console
      console.log(msg);
    }
  });
}

export function noop() {
  return effect("noop", undefined, () => void 0);
}
