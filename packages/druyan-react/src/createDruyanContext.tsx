import {
  Action,
  BoundStateFn,
  Context,
  createInitialContext,
  enter,
  noop,
  Runtime,
  state,
  StateTransition,
} from "@druyan/druyan";
import isFunction from "lodash.isfunction";
import React, {
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

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

export interface ContextValue<
  SM extends { [key: string]: BoundStateFn<any, any, any> },
  AM extends { [key: string]: (...args: any[]) => Action<any> }
> {
  currentState: ReturnType<SM[keyof SM]>;
  context: Context;
  actions: AM;
  runtime?: Runtime;
}

interface Options {
  parent: { Context: React.Context<any> };
  fallback: BoundStateFn<any, any, any>;
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

  const parentContext = options.parent
    ? options.parent.Context
    : React.createContext<any>({});

  const defaultContext = createInitialContext(
    [state("Placeholder", () => noop())()],
    { maxHistory },
  );

  const StateContext = React.createContext<ContextValue<SM, AM>>({
    context: defaultContext,
    currentState: defaultContext.currentState as ReturnType<SM[keyof SM]>,
    actions,
  });

  function Create({
    initialState: initialStateProp,
    children,
  }: CreateProps<SM, AM>) {
    const [initialState, resetState] = useState(initialStateProp);

    useEffect(() => {
      if (restartOnInitialStateChange) {
        resetState(initialStateProp);
      }
    }, [initialStateProp]);

    const possibleParentContext = useContext(parentContext);
    const parentRuntime = possibleParentContext
      ? possibleParentContext.runtime
      : undefined;

    const runtime = useMemo(
      () =>
        Runtime.create(
          createInitialContext([initialState], { maxHistory }),
          Object.keys(actions),
          fallback,
          parentRuntime,
        ),
      [initialState],
    );

    const boundActions = useMemo(() => runtime.bindActions(actions), [runtime]);

    const [value, setValue] = useState<ContextValue<SM, AM>>({
      context: runtime.context,
      currentState: runtime.context.currentState as ReturnType<SM[keyof SM]>,
      actions: boundActions,
      runtime,
    });

    useEffect(() => {
      const unsub = runtime.onContextChange(context =>
        setValue({
          context,
          currentState: context.currentState as ReturnType<SM[keyof SM]>,
          actions: boundActions,
          runtime,
        }),
      );

      runtime.run(enter());

      return unsub;
    }, []);

    return (
      <StateContext.Provider value={value}>
        {isFunction(children) ? (
          <StateContext.Consumer>
            {currentValue =>
              children({
                actions: currentValue.actions,
                context: currentValue.context,
                currentState: currentValue.context.currentState as ReturnType<
                  SM[keyof SM]
                >,
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
