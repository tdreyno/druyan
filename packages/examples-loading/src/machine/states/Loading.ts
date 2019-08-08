import { StateReturn } from "@druyan/druyan";
import { Enter, FinishedLoading } from "../actions";
import { Context } from "../context";
import { loadData } from "../effects";
import { Ready } from "./index";

export function Loading(action: Enter | FinishedLoading): StateReturn<Context> {
  switch (action.type) {
    case "Enter":
      return loadData();

    case "FinishedLoading":
      return Ready(`Hi, ${action.result}`);
  }
}
