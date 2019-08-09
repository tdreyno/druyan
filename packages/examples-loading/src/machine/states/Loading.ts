import { wrapState } from "@druyan/druyan";
import { Enter, FinishedLoading } from "../actions";
import { loadData } from "../effects";
import Ready from "./Ready";

function Loading(action: Enter | FinishedLoading) {
  switch (action.type) {
    case "Enter":
      return loadData();

    case "FinishedLoading":
      return Ready(`Hi, ${action.result}`);
  }
}

export default wrapState(Loading);
