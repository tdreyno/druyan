import { StateReturn } from "@druyan/druyan";
import { Enter, ReEnter, Reset } from "../actions";
import { Context } from "../context";
import { goBack, noop, reenter } from "../effects";

export function Ready(action: Enter | Reset | ReEnter): StateReturn<Context> {
  switch (action.type) {
    case "Enter":
      return noop();

    case "Reset":
      return goBack();

    case "ReEnter":
      return reenter();
  }
}
