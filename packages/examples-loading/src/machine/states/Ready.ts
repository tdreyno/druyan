import { Enter } from "../actions";
import { noop } from "../effects";

export function Ready(action: Enter) {
  switch (action.type) {
    case "Enter":
      return noop();
  }
}
