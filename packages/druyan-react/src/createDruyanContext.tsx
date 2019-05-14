import { Action, Context as BaseContext, StateFn } from "@druyan/druyan";
import React, { ReactNode } from "react";
import { Druyan } from "./Druyan";

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

interface ContextShape<
  C extends BaseContext,
  AM extends { [key: string]: (...args: any[]) => Action<any> },
  CSN extends string
> {
  currentStateName: CSN;
  actions: AM;
  context: C;
}

interface CreateProps<
  C extends BaseContext,
  AM extends { [key: string]: (...args: any[]) => Action<any> },
  CSN extends string
> {
  initialContext: Omit<C, "history"> & {
    history?: CSN[];
  };

  children?: (data: {
    currentStateName: CSN;
    actions: AM;
    context: C;
  }) => ReactNode;
}

export function createDruyanContext<
  C extends BaseContext,
  AM extends { [key: string]: (...args: any[]) => Action<any> },
  SM extends { [key: string]: StateFn<Action<any>, C> }
>(
  states: SM,
  initialState: StateFn<Action<any>, C>,
  actionMap: AM,
  updateContextOnChange?: boolean,
  fallbackState?: StateFn<Action<any>, C>,
) {
  type StateNames = Extract<keyof SM, string>;
  type Shape = ContextShape<C, AM, StateNames>;
  type Props = CreateProps<C, AM, StateNames>;

  function Create({ initialContext, children }: Props) {
    if (!initialContext.history) {
      initialContext.history = [];
    }

    return (
      <StateProvider
        value={({ context: initialContext } as unknown) as Shape}
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
        initialContext={value.context}
        updateContextOnChange={updateContextOnChange}
        states={states}
        initialState={initialState}
        fallbackState={fallbackState}
        actions={actionMap}
      >
        {(currentStateName, actions, context) => {
          return (
            <DruyanContext.Provider
              value={{
                currentStateName,
                actions,
                context,
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
