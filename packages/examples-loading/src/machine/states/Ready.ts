import { Enter, eventually, Exit, state, StateReturn } from "@druyan/druyan";
import { ReEnter, Reset, reset } from "../actions";
import { goBack, log, noop } from "../effects";
import { Shared } from "../types";

async function Ready(
  action: Enter | Reset | ReEnter | Exit,
  shared: Shared,
): Promise<StateReturn | StateReturn[]> {
  const eventuallyReset = eventually(reset, {
    doNotUnsubscribeOnExit: true,
  });

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

const ReadyState = state("Ready", Ready);
const { reenter } = ReadyState;
export default ReadyState;
