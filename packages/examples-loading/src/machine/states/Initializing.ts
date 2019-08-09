import { wrapState } from "@druyan/druyan";
import { Enter, StartLoading, startLoading } from "../actions";
import Loading from "./Loading";

function Initializing(action: Enter | StartLoading) {
  switch (action.type) {
    case "Enter":
      return startLoading();

    case "StartLoading":
      return Loading();
  }
}

export default wrapState(Initializing);
