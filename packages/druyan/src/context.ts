import { StateTransition } from "./state";

export type History = Array<StateTransition<any, any, any>>;

export interface Context {
  maxHistory?: number;
  history: History;
  allowUnhandled?: boolean;
  customLogger?: (msgs: any[], level: "error" | "warn" | "log") => void;
}
