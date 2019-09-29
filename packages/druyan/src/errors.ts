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

export class NoStatesRespondToAction extends Error {
  constructor(
    public states: Array<StateTransition<any, any, any>>,
    public action: Action<any>,
  ) {
    super();
  }

  toString() {
    return `No states "${this.states
      .map(s => s.name)
      .join(", ")}" could not respond to action: ${this.action.type}`;
  }
}

export class NoMatchingActionTargets extends Error {}

export class MissingCurrentState extends Error {}

export class EnterExitMustBeSynchronous extends Error {}

export class UnknownStateReturnType extends Error {}
