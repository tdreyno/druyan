import { StateReturn } from "@druyan/druyan";
import { Enter, StartLoading, startLoading } from "../actions";
import { Context } from "../context";
import { Loading } from "./index";

export function Initializing(
  action: Enter | StartLoading,
): StateReturn<Context> {
  switch (action.type) {
    case "Enter":
      return startLoading();

    case "StartLoading":
      return Loading();
  }
}
