import { Enter, state, StateReturn } from "@druyan/druyan";
import { FinishedLoading, Update } from "../actions";
import { loadData } from "../effects";
import { Shared } from "../types";
import Ready from "./Ready";

async function Loading(
  action: Enter | FinishedLoading | Update,
  shared: Shared,
  str: string,
): Promise<StateReturn | StateReturn[]> {
  switch (action.type) {
    case "Enter":
      return loadData();

    case "FinishedLoading":
      return Ready({ ...shared, message: `Hi, ${action.result}` });

    case "Update":
      shared.message = shared.message + " " + shared.message;

      return update(shared, str);
  }
}

const LoadingState = state("Loading", Loading);
const { update } = LoadingState;
export default LoadingState;
