import { StateReturn } from "@druyan/druyan";
import { Enter, StartLoading, startLoading } from "../actions";
import { Context } from "../context";
import { goto, sendAction } from "../effects";
import { Loading } from "./Loading";

export function Initializing(
  action: Enter | StartLoading,
): StateReturn<Context> {
  switch (action.type) {
    case "Enter":
      return sendAction(startLoading());

    case "StartLoading":
      return goto(Loading);
  }
}
