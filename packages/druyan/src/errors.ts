// tslint:disable: max-classes-per-file
import { Action } from "./action";
import { StateTransition } from "./state";

export class StateDidNotRespondToAction extends Error {
  constructor(
    public state: StateTransition<any, any, any>,
    public action: Action<any>,
  ) {
    super();
  }

  toString() {
    return `State "${this.state.name}" could not respond to action: ${this.action.type}`;
  }
}

export class MissingCurrentState extends Error {}
