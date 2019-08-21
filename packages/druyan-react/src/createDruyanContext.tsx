// tslint:disable: jsx-no-multiline-js
import {
  Action,
  BoundStateFn,
  Context,
  createInitialContext,
  StateTransition,
} from "@druyan/druyan";
import React, { ReactNode } from "react";
import { Druyan } from "./Druyan";

export interface ContextShape<
  SM extends { [key: string]: BoundStateFn<any, any, any> },
  AM extends { [key: string]: (...args: any[]) => Action<any> }
> {
  actions: AM;
  context: Context;
  currentState: ReturnType<SM[keyof SM]>;
}

export interface CreateProps<
  SM extends { [key: string]: BoundStateFn<any, any, any> },
  AM extends { [key: string]: (...args: any[]) => Action<any> }
> {
  initialState: StateTransition<any, any, any>;
  children?: (api: {
    actions: AM;
    context: Context;
    currentState: ReturnType<SM[keyof SM]>;
  }) => ReactNode;
}

interface Options {
  fallback: BoundStateFn<any, any, any>;
  allowUnhandled: boolean;
  maxHistory: number;
}

export function createDruyanContext<
  SM extends { [key: string]: BoundStateFn<any, any, any> },
  AM extends { [key: string]: (...args: any[]) => Action<any> }
>(_states: SM, actions: AM, options?: Partial<Options>) {
  type Shape = ContextShape<SM, AM>;
  type Props = CreateProps<SM, AM>;

  function Create({ initialState, children }: Props) {
    const context = createInitialContext([initialState], {
      // allowUnhandled: options ? options.allowUnhandled : undefined,
      maxHistory: options ? options.maxHistory : 5, // Default React to 5 history
    });

    const currentState = context.currentState as ReturnType<SM[keyof SM]>;

    return (
      <StateProvider
        value={{ context, actions, currentState }}
        children={children}
      />
    );
  }

  type DruyanContext = React.Context<Shape> & {
    Create: typeof Create;
  };

  const DruyanContext = React.createContext<Shape>({
    actions: {},
  } as any) as DruyanContext;

  interface ProviderProps {
    children?: ReactNode | ((value: Shape) => ReactNode);
    value: Shape;
  }

  const StateProvider = ({ value, children }: ProviderProps) => {
    return (
      <Druyan
        context={value.context}
        fallback={options ? options.fallback : undefined}
        actions={actions}
      >
        {({ actions: boundActions, context: currentContext, currentState }) => {
          return (
            <DruyanContext.Provider
              value={{
                actions: boundActions,
                context: currentContext,
                currentState: currentState as ReturnType<SM[keyof SM]>,
              }}
            >
              {children ? (
                <DruyanContext.Consumer
                  children={children as ((value: Shape) => ReactNode)}
                />
              ) : (
                undefined
              )}
            </DruyanContext.Provider>
          );
        }}
      </Druyan>
    );
  };

  DruyanContext.Create = Create;

  return DruyanContext;
}
