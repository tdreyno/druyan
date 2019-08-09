import { wrapState } from "@druyan/druyan";
import { Enter, ReEnter, Reset } from "../actions";
import { goBack, log, reenter } from "../effects";
import { Shared } from "../types";

function Ready(action: Enter | Reset | ReEnter, shared: Shared) {
  switch (action.type) {
    case "Enter":
      return log(shared.message);

    case "Reset":
      return goBack();

    case "ReEnter":
      return reenter();
  }
}

export default wrapState(Ready, "Ready");
