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
  AM extends { [key: string]: (...args: any[]) => Action<any> }
> {
  actions: AM;
  context: Context;
  currentState: StateTransition<any, any, any>;
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
  fallbackState: StateTransition<any, any, any>;
  allowUnhandled: boolean;
  maxHistory: number;
}

export function createDruyanContext<
  SM extends { [key: string]: BoundStateFn<any, any, any> },
  AM extends { [key: string]: (...args: any[]) => Action<any> }
>(_states: SM, actions: AM, options?: Partial<Options>) {
  type Shape = ContextShape<AM>;
  type Props = CreateProps<SM, AM>;

  function Create({ initialState, children }: Props) {
    const context = createInitialContext([initialState], {
      // allowUnhandled: options ? options.allowUnhandled : undefined,
      maxHistory: options ? options.maxHistory : 5, // Default React to 5 history
    });

    const currentState = context.currentState;

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
        fallbackState={options ? options.fallbackState : undefined}
        actions={actions}
      >
        {({ actions: boundActions, context: currentContext, currentState }) => {
          return (
            <DruyanContext.Provider
              value={{
                actions: boundActions,
                context: currentContext,
                currentState,
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
