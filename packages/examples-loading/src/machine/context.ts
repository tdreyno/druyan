import { Context as BaseContext } from "@druyan/druyan";
import * as StateMap from "./states";

export type Context = BaseContext<typeof StateMap>;
