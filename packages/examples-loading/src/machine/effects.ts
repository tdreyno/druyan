import {
  contextEffect,
  goBack as oldGoBack,
  reenter as oldReenter,
} from "@druyan/druyan";
import { finishedLoading } from "./actions";
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

export function goBack() {
  return oldGoBack<Context>();
}

export function reenter() {
  return oldReenter<Context>();
}
