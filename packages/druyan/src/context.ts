import { StateTransition } from "./state";

export type History = Array<StateTransition<any, any, any>>;

export interface Context {
  maxHistory: number;
  onAsyncEnterExit?: "throw" | "warn" | "silent";
  history: History;
  allowUnhandled: boolean;
  disableLogging: boolean;
  customLogger?: (msgs: any[], level: "error" | "warn" | "log") => void;
}
