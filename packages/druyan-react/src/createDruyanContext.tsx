// tslint:disable: jsx-no-multiline-js
import {
  Action,
  BoundStateFn,
  Context,
  createInitialContext,
  getCurrentState,
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

export function createDruyanContext<
  SM extends { [key: string]: BoundStateFn<any, any, any> },
  AM extends { [key: string]: (...args: any[]) => Action<any> }
>(
  states: SM,
  actions: AM,
  {
    updateContextOnChange,
    fallbackState,
  }: {
    updateContextOnChange?: boolean;
    fallbackState?: StateTransition<any, any, any>;
  },
) {
  type Shape = ContextShape<AM>;
  type Props = CreateProps<SM, AM>;

  function Create({ initialState, children }: Props) {
    const context = createInitialContext([initialState]);

    const currentState = getCurrentState(context)!;

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

  const DruyanContext = React.createContext<Shape>({} as any) as DruyanContext;

  interface ProviderProps {
    children?: ReactNode | ((value: Shape) => ReactNode);
    value: Shape;
  }

  const StateProvider = ({ value, children }: ProviderProps) => {
    return (
      <Druyan
        context={value.context}
        updateContextOnChange={updateContextOnChange}
        states={states}
        fallbackState={fallbackState}
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
