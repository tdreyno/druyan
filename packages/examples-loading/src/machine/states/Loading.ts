import { state } from "@druyan/druyan";
import { Enter, FinishedLoading } from "../actions";
import { loadData } from "../effects";
import { Shared } from "../types";
import Ready from "./Ready";

function Loading(action: Enter | FinishedLoading, shared: Shared) {
  switch (action.type) {
    case "Enter":
      return loadData();

    case "FinishedLoading":
      return Ready({ ...shared, message: `Hi, ${action.result}` });
  }
}

export default state(Loading, "Loading");
