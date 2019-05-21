import { Enter, StartLoading, startLoading } from "../actions";
import { goto, sendAction } from "../effects";
import { Loading } from "./Loading";

export function Initializing(action: Enter | StartLoading) {
  switch (action.type) {
    case "Enter":
      return sendAction(startLoading());

    case "StartLoading":
      return goto(Loading);
  }
}
