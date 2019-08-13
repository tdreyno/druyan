import { createDruyanContext } from "@druyan/druyan-react";
import * as Actions from "./actions";
import States from "./states";

export { States };

export const StateContext = createDruyanContext(States, Actions);
