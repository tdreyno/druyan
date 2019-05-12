import { StateReturn } from "@druyan/druyan";
import { Enter } from "../actions";
import { Context } from "../context";
import { noop } from "../effects";

export async function Ready(action: Enter): Promise<StateReturn<Context>> {
  switch (action.type) {
    case "Enter":
      return noop();
  }
}
