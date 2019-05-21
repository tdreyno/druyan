import { Enter, Reset } from "../actions";
import { noop, goBack } from "../effects";

export function Ready(action: Enter | Reset) {
  switch (action.type) {
    case "Enter":
      return noop();

    case "Reset":
      return goBack();
  }
}
