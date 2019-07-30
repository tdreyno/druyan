import {
  contextEffect,
  Enter,
  goBack as oldGoBack,
  goto as oldGoto,
  reenter as oldReenter,
  sendAction as oldSendAction,
  set as oldSet,
  StateFn,
} from "@druyan/druyan";
import { Actions, finishedLoading } from "./actions";
import { Context } from "./context";
export { noop } from "@druyan/druyan";

function timeout(ts: number) {
  return new Promise(resolve => setTimeout(() => resolve(), ts));
}

export function loadData() {
  return contextEffect("loadData", undefined, async (_, run) => {
    await timeout(3000);
    run(finishedLoading("Your Name"));
  });
}

/**
 * Everything below is boilerplate and can be DRY'd up
 * with some Typescript magic.
 */

// Bind the global ContextFns to our Context
export function set(setters: Partial<Context>) {
  return oldSet<Context>(setters);
}

export function goto<S extends Enter>(fn: StateFn<S, any>) {
  return oldGoto<Context>(fn);
}

export function goBack() {
  return oldGoBack<Context>();
}

export function reenter() {
  return oldReenter<Context>();
}

export function sendAction(a: Actions) {
  return oldSendAction<Context, Actions>(a);
}
