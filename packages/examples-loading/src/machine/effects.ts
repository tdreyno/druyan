import { contextEffect } from "@druyan/druyan";
import { finishedLoading } from "./actions";
export { noop, log, goBack, reenter } from "@druyan/druyan";

function timeout(ts: number) {
  return new Promise(resolve => setTimeout(() => resolve(), ts));
}

export function loadData() {
  return contextEffect("loadData", undefined, async () => {
    await timeout(3000);

    return finishedLoading("Your Name");
  });
}
