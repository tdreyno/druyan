import { Context as BaseContext } from "@druyan/druyan";
import { ActionMap } from "./actions";
import { StateMap } from "./states";

export interface Context
  extends BaseContext<typeof StateMap, typeof ActionMap> {
  message?: string;
}
