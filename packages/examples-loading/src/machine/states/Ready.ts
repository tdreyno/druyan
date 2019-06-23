import { StateReturn } from "@druyan/druyan";
import { Enter, Reset } from "../actions";
import { Context } from "../context";
import { goBack, noop } from "../effects";

export function Ready(
  action: Enter | Reset,
  _c: Context,
  _r: any,
  message: string,
): StateReturn<Context> {
  switch (action.type) {
    case "Enter":
      // tslint:disable-next-line:no-console
      console.log(message);

      return noop();

    case "Reset":
      return goBack();
  }
}
