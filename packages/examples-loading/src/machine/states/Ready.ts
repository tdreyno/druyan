import { wrapState } from "@druyan/druyan";
import { Enter, ReEnter, Reset } from "../actions";
import { goBack, log, reenter } from "../effects";

function Ready(action: Enter | Reset | ReEnter, message: string) {
  switch (action.type) {
    case "Enter":
      return log(message);

    case "Reset":
      return goBack();

    case "ReEnter":
      return reenter();
  }
}

export default wrapState(Ready);
