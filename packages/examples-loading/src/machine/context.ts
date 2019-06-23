import { Context as BaseContext } from "@druyan/druyan";
import { StateMap } from "./states";

export interface Context extends BaseContext<typeof StateMap> {
  message?: string;
}
