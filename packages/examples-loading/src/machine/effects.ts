import { finishedLoading } from "./actions";
export { noop, log, goBack, reenter, effect } from "@druyan/druyan";

function timeout(ts: number) {
  return new Promise(resolve => setTimeout(() => resolve(), ts));
}

export async function loadData() {
  await timeout(3000);

  return finishedLoading("Your Name");
}
