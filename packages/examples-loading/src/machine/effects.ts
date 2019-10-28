import { Task } from "@tdreyno/pretty-please";
import { finishedLoading } from "./actions";
export { noop, log, goBack, effect } from "@druyan/druyan";

export function loadData() {
  return Task.of(finishedLoading("Your Name")).wait(3000);
}
