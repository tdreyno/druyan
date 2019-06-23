import {
  contextEffect,
  Enter,
  goBack as oldGoBack,
  goto as oldGoto,
  sendAction as oldSendAction,
  set as oldSet,
  StateFn,
} from "@druyan/druyan";
import { partialRight } from "ramda";
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

export type Head<T extends any[]> = T extends [any, ...any[]] ? T[0] : never;

export type Tail<T extends any[]> = ((...t: T) => any) extends ((
  _: any,
  ...tail: infer TT
) => any)
  ? TT
  : [];

export function goto<
  A extends Enter,
  F extends StateFn<A, any>,
  P extends Tail<Tail<Tail<Parameters<F>>>>
>(fn: F, ...args: P) {
  return oldGoto<Context>(partialRight(fn, args));
}

export function goBack() {
  return oldGoBack<Context>();
}

export function sendAction(a: Actions) {
  return oldSendAction<Context, Actions>(a);
}
