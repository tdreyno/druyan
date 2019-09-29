import { createDruyanContext } from "@druyan/druyan-react";
import { StateContext as ParentStateContext } from "../parent";
import * as Actions from "./actions";
import States from "./states";

export { States };

export const StateContext = createDruyanContext(States, Actions, {
  parent: ParentStateContext,
});
