import {
  Enter,
  Exit,
  onDOMEventSubscription,
  state,
  StateReturn,
  subscribe,
  unsubscribe,
} from "@druyan/druyan";
import { ReEnter, Reset, reset } from "../actions";
import { goBack, log } from "../effects";
import { Shared } from "../types";

function Ready(
  action: Enter | Reset | ReEnter | Exit,
  shared: Shared,
): StateReturn | StateReturn[] {
  switch (action.type) {
    case "Enter":
      const sub = onDOMEventSubscription(window, "resize", () =>
        window.innerWidth < 500 ? reset() : void 0,
      );

      return [log(shared.message), subscribe("resize", sub)];

    case "Reset":
      return goBack();

    case "ReEnter":
      return reenter(shared);

    case "Exit":
      return unsubscribe("resize");
  }
}

const ReadyState = state("Ready", Ready);
const { reenter } = ReadyState;
export default ReadyState;
