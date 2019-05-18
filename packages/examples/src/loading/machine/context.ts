import { Context as BaseContext } from "@druyan/druyan";

export interface Context extends BaseContext {
  message?: string;
}
