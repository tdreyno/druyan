import { eventualAction, wrapState } from "@druyan/druyan";
import { Enter, Exit, ReEnter, Reset, reset } from "../actions";
import { goBack, log, noop, reenter } from "../effects";
import { Shared } from "../types";

function Ready(action: Enter | Reset | ReEnter | Exit, shared: Shared) {
  const eventuallyReset = eventualAction(reset);

  const onResize = () => {
    if (window.innerWidth < 500) {
      eventuallyReset();
    }
  };

  switch (action.type) {
    case "Enter":
      window.addEventListener("resize", onResize);

      return [log(shared.message), eventuallyReset];

    case "Reset":
      return goBack();

    case "ReEnter":
      return reenter();

    case "Exit":
      window.removeEventListener("resize", onResize);

      eventuallyReset.destroy();

      return noop();
  }
}

export default wrapState(Ready, "Ready");
