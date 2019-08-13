// tslint:disable: jsx-no-multiline-js
import {
  Action,
  ActionCreator,
  Context,
  enter,
  Runtime,
  StateTransition,
} from "@druyan/druyan";
import cloneDeep from "lodash.clonedeep";
import { Component, ReactNode } from "react";

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
  version: number;
}

export class Druyan<
  AM extends { [key: string]: ActionCreator<any, any> }
> extends Component<Props<AM>, State> {
  state: State = {
    context: this.props.context,
    version: 1,
  };

  private boundActions: AM;
  private runtime: Runtime;

  constructor(props: Props<AM>) {
    super(props);

    this.boundActions = this.bindActions(this.props.actions);

    this.runtime = Runtime.create(
      cloneDeep(props.context),
      props.fallbackState,
    );

    this.runtime.onContextChange(context => {
      this.setState({ context, version: this.state.version + 1 });
    });
  }

  componentDidMount() {
    this.runtime.run(enter());
  }

  render() {
    const currentState = this.runtime.currentState();

    if (!currentState) {
      throw new Error(
        `Druyan could not find current state. History: ${this.runtime
          .currentHistory()
          .map(({ name }) => name)
          .join(" -> ")}`,
      );
    }

    return this.props.children({
      currentState,
      actions: this.boundActions,
      context: this.state.context,
    });
  }

  private bindActions(actions: AM): AM {
    return Object.keys(actions).reduce(
      (sum, key) => {
        sum[key] = (...args: any[]) => this.runtime.run(actions[key](...args));

        return sum;
      },
      {} as any,
    ) as AM;
  }
}
