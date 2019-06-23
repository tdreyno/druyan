import { StateReturn } from "@druyan/druyan";
import { Enter, FinishedLoading } from "../actions";
import { Context } from "../context";
import { goto, loadData } from "../effects";
import { Ready } from "./Ready";

export function Loading(action: Enter | FinishedLoading): StateReturn<Context> {
  switch (action.type) {
    case "Enter":
      return loadData();

    case "FinishedLoading":
      return goto(Ready, `Hi, ${action.result}`);
  }
}
