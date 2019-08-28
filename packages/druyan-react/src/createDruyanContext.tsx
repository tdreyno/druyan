import {
  Action,
  BoundStateFn,
  Context,
  createInitialContext,
  Runtime,
  StateTransition,
} from "@druyan/druyan";
import isFunction from "lodash.isfunction";
import React, { ReactNode, useEffect, useState } from "react";

export interface CreateProps<
  SM extends { [key: string]: BoundStateFn<any, any, any> },
  AM extends { [key: string]: (...args: any[]) => Action<any> }
> {
  initialState: StateTransition<any, any, any>;
  children:
    | ReactNode
    | ((api: {
        actions: AM;
        context: Context;
        currentState: ReturnType<SM[keyof SM]>;
      }) => ReactNode);
}

interface Options {
  fallback: BoundStateFn<any, any, any>;
  allowUnhandled: boolean;
  maxHistory: number;
  restartOnInitialStateChange?: boolean;
}

export function createDruyanContext<
  SM extends { [key: string]: BoundStateFn<any, any, any> },
  AM extends { [key: string]: (...args: any[]) => Action<any> }
>(
  _states: SM,
  actions: AM,
  options: Partial<Options> = {
    maxHistory: 5,
  },
) {
  const { restartOnInitialStateChange, maxHistory, fallback } = options;

  const StateContext = React.createContext<Context>(createInitialContext());

  function Create({ initialState, children }: CreateProps<SM, AM>) {
    const [currentContext, setCurrentContext] = useState<Context>(
      createInitialContext([initialState], { maxHistory }),
    );

    useEffect(() => {
      if (restartOnInitialStateChange) {
        setCurrentContext(createInitialContext([initialState], { maxHistory }));
      }
    }, [initialState]);

    const runtime = Runtime.create(currentContext, fallback);

    useEffect(() => {
      return runtime.onContextChange(setCurrentContext);
    }, []);

    const boundActions = runtime.bindActions(actions);

    return (
      <StateContext.Provider value={currentContext}>
        {isFunction(children) ? (
          <StateContext.Consumer>
            {context =>
              children({
                actions: boundActions,
                context,
                currentState: context.currentState as ReturnType<SM[keyof SM]>,
              })
            }
          </StateContext.Consumer>
        ) : (
          children
        )}
      </StateContext.Provider>
    );
  }

  return {
    Context: StateContext,
    Create,
  };
}
