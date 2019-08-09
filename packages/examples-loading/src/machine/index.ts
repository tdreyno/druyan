import { createDruyanContext } from "@druyan/druyan-react";
import * as Actions from "./actions";
import Initializing from "./states/Initializing";
import Loading from "./states/Loading";
import Ready from "./states/Ready";

const States = { Initializing, Loading, Ready };

export const StateContext = createDruyanContext(States, Actions, {
  updateContextOnChange: true,
});
