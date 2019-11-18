import { Enter, state, StateReturn } from "@druyan/druyan";
import { StartLoading, startLoading } from "../actions";
import { Shared } from "../types";
import Loading from "./Loading";

function Initializing(
  action: Enter | StartLoading,
  shared: Shared,
  _bool: boolean,
): StateReturn | StateReturn[] {
  switch (action.type) {
    case "Enter":
      return startLoading();

    case "StartLoading":
      return Loading(shared, "test");
  }
}

export default state("Initalizing", Initializing);
