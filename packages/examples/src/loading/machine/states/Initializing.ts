import { StateReturn } from "@druyan/druyan";
import { Enter, StartLoading, startLoading } from "../actions";
import { Context } from "../context";
import { goto, sendAction } from "../effects";
import { Loading } from "./Loading";

export async function Initializing(
  action: Enter | StartLoading,
): Promise<StateReturn<Context>> {
  switch (action.type) {
    case "Enter":
      return sendAction(startLoading());

    case "StartLoading":
      return goto(Loading);
  }
}
