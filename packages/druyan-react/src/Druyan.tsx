import {
  Action,
  Context,
  currentState,
  Effect,
  enter,
  execute,
  runEffects,
  StateDidNotRespondToAction,
  StateFn,
} from "@druyan/druyan";
import cloneDeep from "lodash/cloneDeep";
import isEqual from "lodash/isEqual";
import React, { Component, ReactNode } from "react";

interface Props<
  C extends Context<any>,
  A extends Action<any>,
  AM extends { [key: string]: (...args: any[]) => Action<any> },
  SM extends { [key: string]: StateFn<Action<any>, C> },
  CSN extends string
> {
  initialContext: C;
  updateContextOnChange?: boolean;
  states: SM;
  initialState: StateFn<A, C>;
  actions: AM;
  children: (currentStateName: CSN, actions: AM, context: C) => ReactNode;
}

interface State<C extends Context<any>> {
  context: C;
}

export class Druyan<
  C extends Context<any>,
  A extends Action<any>,
  AM extends { [key: string]: (...args: any[]) => Action<any> },
  SM extends { [key: string]: StateFn<Action<any>, C> },
  CSN extends Extract<keyof SM, string>
> extends Component<Props<C, A, AM, SM, CSN>, State<C>> {
  actions: AM = Object.keys(this.props.actions).reduce(
    (sum, key) => {
      sum[key] = (action: Action<any>) =>
        this.runAction(this.props.actions[key](action));
      return sum;
    },
    {} as any,
  ) as AM;

  constructor(props: Props<C, A, AM, SM, CSN>) {
    super(props);

    this.state = {
      context: {
        ...this.props.initialContext,
        history: [this.props.initialState.name],
      },
    };

    this.runAction = this.runAction.bind(this);
    this.runNextFrame = this.runNextFrame.bind(this);
  }

  runNextFrame(a: Action<any>) {
    requestAnimationFrame(() => this.runAction(a));
  }

  currentState() {
    return currentState(this.state.context, this.props.states);
  }

  async runAction(currentAction: Action<any>) {
    const context = cloneDeep(this.state.context);

    const runCurrentState = this.currentState();

    if (!runCurrentState) {
      throw new Error("Druyan could not find current state to run action on");
    }

    let effects: Effect[] = [];

    try {
      effects = await execute(
        currentAction,
        runCurrentState,
        context,
        this.runNextFrame,
      );
    } catch (e) {
      // Handle known error types.
      if (e instanceof StateDidNotRespondToAction) {
        // It's okay to not care about rAF
        if (e.action.type === "OnFrame") {
          return;
        }

        // tslint:disable-next-line:no-console
        console.warn(e.toString());

        effects = [];
      } else {
        // Otherwise rethrow
        throw e;
      }
    }

    runEffects(effects);

    // TODO: Is this deep equality check necessary?
    // if (!isEqual(this.state.context, context)) {
    this.setState({ context });
    // }
  }

  componentDidMount() {
    this.runAction(enter());
  }

  shouldComponentUpdate(
    nextProps: Props<C, A, AM, SM, CSN>,
    nextState: State<C>,
    nextContext: any,
  ) {
    if (nextProps.initialContext !== this.props.initialContext) {
      if (!isEqual(nextProps.initialContext, this.props.initialContext)) {
        if (this.props.updateContextOnChange) {
          setTimeout(() => {
            this.setState({
              context: {
                ...this.state.context,
                ...nextProps.initialContext,
                history: this.state.context.history,
              },
            });
          }, 0);

          return true;
        }

        // tslint:disable-next-line:no-console
        console.warn(
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
    const { states } = this.props;

    const cs = currentState(this.state.context, states);

    if (!cs) {
      throw new Error("Druyan could not find current state");
    }

    return (
      <>
        {/* <h1>Debug: {cs.name}</h1> */}
        {this.props.children(cs.name as CSN, this.actions, this.state.context)}
      </>
    );
  }
}
