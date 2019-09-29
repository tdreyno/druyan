import { Enter, noop, state, StateReturn } from "@druyan/druyan";
import { Say } from "../actions";

async function Entry(
  action: Enter | Say,
): Promise<StateReturn | StateReturn[]> {
  switch (action.type) {
    case "Enter":
      return noop();

    case "Say":
      // tslint:disable-next-line: no-console
      console.log(action.message);

      return noop();
  }
}

export default state("Entry", Entry);
