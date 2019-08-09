import { wrapState } from "@druyan/druyan";
import { Enter, StartLoading, startLoading } from "../actions";
import { Shared } from "../types";
import Loading from "./Loading";

function Initializing(action: Enter | StartLoading, shared: Shared) {
  switch (action.type) {
    case "Enter":
      return startLoading();

    case "StartLoading":
      return Loading(shared);
  }
}

export default wrapState(Initializing, "Initalizing");
