import { Enter, Exit, state, StateReturn } from "@druyan/druyan";
import { Task } from "@tdreyno/pretty-please";
import { ReEnter, Reset, reset } from "../actions";
import { goBack, log, noop } from "../effects";
import { Shared } from "../types";

function Ready(
  action: Enter | Reset | ReEnter | Exit,
  shared: Shared,
): StateReturn | StateReturn[] {
  const eventuallyReset = Task.external();

  const onResize = () => {
    if (window.innerWidth < 500) {
      eventuallyReset.resolve(reset());
    }
  };

  switch (action.type) {
    case "Enter":
      window.addEventListener("resize", onResize);

      return [log(shared.message), eventuallyReset];

    case "Reset":
      return goBack();

    case "ReEnter":
      return reenter(shared);

    case "Exit":
      window.removeEventListener("resize", onResize);

      return noop();
  }
}

const ReadyState = state("Ready", Ready);
const { reenter } = ReadyState;
export default ReadyState;
