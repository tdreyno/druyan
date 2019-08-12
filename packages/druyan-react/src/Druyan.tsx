// tslint:disable: jsx-no-multiline-js
import {
  Action,
  Context,
  Effect,
  enter,
  EventualAction,
  execute,
  getCurrentState,
  isEventualAction,
  runEffects,
  StateDidNotRespondToAction,
  StateTransition,
} from "@druyan/druyan";
import cloneDeep from "lodash.clonedeep";
import React, { Component, ReactNode } from "react";

interface Props<AM extends { [key: string]: (...args: any[]) => Action<any> }> {
  context: Context;
  actions: AM;
  fallbackState?: StateTransition<any, any, any>;
  children: (api: {
    currentState: StateTransition<any, any, any>;
    actions: AM;
    context: Context;
  }) => ReactNode;
}

interface State {
  context: Context;
}

export class Druyan<
  AM extends { [key: string]: (...args: any[]) => Action<any> }
> extends Component<Props<AM>, State> {
  actions: AM = Object.keys(this.props.actions).reduce(
    (sum, key) => {
      sum[key] = (action: Action<any>) =>
        this.runAction(this.props.actions[key](action));
      return sum;
    },
    {} as any,
  ) as AM;

  state: State = {
    context: this.props.context,
  };

  unsubOnExit: { [key: string]: Array<() => void> } = {};

  constructor(props: Props<AM>) {
    super(props);

    this.runAction = this.runAction.bind(this);
    this.runNextFrame = this.runNextFrame.bind(this);
  }

  runNextFrame(a: Action<any>) {
    requestAnimationFrame(() => this.runAction(a));
  }

  currentState() {
    return getCurrentState(this.state.context);
  }

  currentHistory() {
    return this.state.context.history;
  }

  // tslint:disable-next-line:max-func-body-length
  async runAction(currentAction: Action<any>) {
    const context = cloneDeep(this.state.context);

    const runCurrentState = this.currentState();

    if (!runCurrentState) {
      throw new Error(
        `Druyan could not find current state to run action on. History: ${JSON.stringify(
          this.currentHistory()
            .map(({ name }) => name)
            .join(" -> "),
        )}`,
      );
    }

    let effects: Effect[] = [];

    try {
      effects = await execute(currentAction, context);
    } catch (e) {
      // Handle known error types.
      if (e instanceof StateDidNotRespondToAction) {
        // It's okay to not care about rAF
        if (e.action.type === "OnFrame") {
          return;
        }

        if (this.props.fallbackState) {
          try {
            effects = await execute(
              currentAction,
              context,
              this.props.fallbackState,
            );
          } catch (e) {
            // Handle known error types.
            if (e instanceof StateDidNotRespondToAction) {
              // tslint:disable-next-line:no-console
              console.warn(
                `${e.toString()}. Fallback state "${
                  this.props.fallbackState.name
                }" also failed to handle event.`,
              );

              effects = [];
            }
          }
        } else {
          // tslint:disable-next-line:no-console
          console.warn(e.toString());

          effects = [];
        }
      } else {
        // Otherwise rethrow
        throw e;
      }
    }

    runEffects(context, effects);

    const runNextActions = effects.filter(e => e.label === "runNextAction");

    if (runNextActions.length > 0) {
      if (runNextActions.length > 1) {
        throw new Error("Cannot run more than one `runNextAction`");
      }

      // Run a single "next action" in one rAF cycle.
      this.runNextFrame(runNextActions[0].data);
    }

    const eventualActionsByState = effects.reduce(
      (sum, effect) => {
        // Store eventual actions by state name.
        if (isEventualAction(effect.data)) {
          sum[effect.data.createdInState!.name] =
            sum[effect.data.createdInState!.name] || [];
          sum[effect.data.createdInState!.name].push(effect.data);

          return sum;
        }

        // If non-global eventual actions are exitted in the same
        // transition, clean them up and never subscribe.
        if (effect.label === "exited") {
          if (sum[effect.data.name]) {
            sum[effect.data.name] = sum[effect.data.name].filter(
              e => !e.unsubscribeOnExit,
            );
          }

          if (this.unsubOnExit[effect.data.name]) {
            this.unsubOnExit[effect.data.name].forEach(unsub => unsub());
            delete this.unsubOnExit[effect.data.name];
          }
        }

        return sum;
      },
      {} as { [key: string]: Array<EventualAction<any, any>> },
    );

    // Subscribe to eventual actions
    Object.keys(eventualActionsByState).reduce((sum, stateName) => {
      const eventualActions = eventualActionsByState[stateName];

      for (const eventualAction of eventualActions) {
        const unsubscribe = eventualAction.subscribe(this.runAction);

        // Make a list of automatic unsubscribes
        if (eventualAction.unsubscribeOnExit) {
          sum[stateName] = sum[stateName] || [];
          sum[stateName].push(unsubscribe);
        }
      }

      return sum;
    }, this.unsubOnExit);

    // TODO: Is this deep equality check necessary?
    // if (!isEqual(this.state.context, context)) {
    this.setState({ context });
    // }
  }

  componentDidMount() {
    this.runAction(enter());
  }

  render() {
    const currentState = this.currentState();

    if (!currentState) {
      throw new Error(
        `Druyan could not find current state. History: ${this.currentHistory()
          .map(({ name }) => name)
          .join(" -> ")}`,
      );
    }

    return (
      <>
        {/* <h1>Debug: {currentStateName}</h1> */}
        {this.props.children({
          currentState,
          actions: this.actions,
          context: this.context,
        })}
      </>
    );
  }
}
