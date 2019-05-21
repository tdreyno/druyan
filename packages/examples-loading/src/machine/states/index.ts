// Import local states
import { Initializing } from "./Initializing";
import { Loading } from "./Loading";
import { Ready } from "./Ready";

// Export mapping of state names to functions
export const StateMap = {
  Initializing,
  Ready,
  Loading,
};

// Valid states
export type States = typeof StateMap[keyof typeof StateMap];
