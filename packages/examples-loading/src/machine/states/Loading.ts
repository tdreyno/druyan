import { Enter, FinishedLoading } from "../actions";
import { goto, loadData, set } from "../effects";
import { Ready } from "./Ready";

export function Loading(action: Enter | FinishedLoading) {
  switch (action.type) {
    case "Enter":
      return loadData();

    case "FinishedLoading":
      return [set({ message: `Hi, ${action.result}` }), goto(Ready)];
  }
}
