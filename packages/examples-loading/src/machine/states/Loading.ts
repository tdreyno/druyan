import { Enter, state } from "@druyan/druyan";
import { FinishedLoading } from "../actions";
import { loadData } from "../effects";
import { Shared } from "../types";
import Ready from "./Ready";

function Loading(
  action: Enter | FinishedLoading,
  shared: Shared,
  _str: string,
) {
  switch (action.type) {
    case "Enter":
      return loadData();

    case "FinishedLoading":
      return Ready({ ...shared, message: `Hi, ${action.result}` });
  }
}

export default state("Loading", Loading);
