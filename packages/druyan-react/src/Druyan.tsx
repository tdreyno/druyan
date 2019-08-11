// tslint:disable: jsx-no-multiline-js
import {
  Action,
  BoundStateFn,
  Context,
  Effect,
  enter,
  execute,
  getCurrentState,
  runEffects,
  StateDidNotRespondToAction,
  StateTransition,
} from "@druyan/druyan";
import cloneDeep from "lodash.clonedeep";
import isEqual from "lodash.isequal";
import React, { Component, ReactNode } from "react";

interface Props<
  AM extends { [key: string]: (...args: any[]) => Action<any> },
  SM extends { [key: string]: BoundStateFn<any, any, any> }
> {
  context: Context;
  updateContextOnChange?: boolean;
  states: SM;
  fallbackState?: StateTransition<any, any, any>;
  actions: AM;
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
  AM extends { [key: string]: (...args: any[]) => Action<any> },
  SM extends { [key: string]: BoundStateFn<any, any, any> }
> extends Component<Props<AM, SM>, State> {
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

  constructor(props: Props<AM, SM>) {
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

    // TODO: Is this deep equality check necessary?
    // if (!isEqual(this.state.context, context)) {
    this.setState({ context });
    // }
  }

  componentDidMount() {
    this.runAction(enter());
  }

  shouldComponentUpdate(
    nextProps: Props<AM, SM>,
    nextState: State,
    nextContext: any,
  ) {
    if (nextProps.context !== this.props.context) {
      if (!isEqual(nextProps.context, this.props.context)) {
        if (this.props.updateContextOnChange) {
          setTimeout(() => {
            this.setState({
              context: {
                ...nextProps.context,
              },
            });
          }, 0);

          return true;
        }

        // tslint:disable-next-line:no-console
        console.warn(
          // tslint:disable-next-line: max-line-length
          "Druyan received an update to its initial context. `updateContextOnChange` was set to false. Ignoring update.",
        );
      }
    }

    if (super.shouldComponentUpdate) {
      return super.shouldComponentUpdate(nextProps, nextState, nextContext);
    }

    return true;
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
