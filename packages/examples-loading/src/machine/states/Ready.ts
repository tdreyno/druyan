import { StateReturn } from "@druyan/druyan";
import { Enter, Reset } from "../actions";
import { Context } from "../context";
import { goBack, noop } from "../effects";

export function Ready(action: Enter | Reset): StateReturn<Context> {
  switch (action.type) {
    case "Enter":
      return noop();

    case "Reset":
      return goBack();
  }
}
