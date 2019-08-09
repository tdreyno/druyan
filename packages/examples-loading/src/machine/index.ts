import { createDruyanContext } from "@druyan/druyan-react";
import * as ActionMap from "./actions";
import * as StateMap from "./states";

export const StateContext = createDruyanContext(
  StateMap,
  StateMap.Initializing,
  ActionMap,
  true,
);
