import { Action } from "./Action";
import { Context } from "./Context";

export interface Effect {
  label: string;
  data: any;
  executor: () => void | Action<any> | Promise<void> | Promise<Action<any>>;
}

export function isEffect(e: any): e is Effect {
  return e && e.executor;
}

export function effect<
  D extends any,
  F extends () => void | Action<any> | Promise<void> | Promise<Action<any>>
>(label: string, data: D, executor: F): Effect {
  return {
    label,
    data,
    executor,
  };
}

export function contextEffect<C extends Context<any>, A extends Action<any>>(
  label: string,
  data: any,
  fn: (context: C, runLater: (laterA: A) => void) => void | Promise<void>,
) {
  return (context: C, runLater?: (laterA: A) => void) => {
    return effect(label, data, () =>
      fn(context, runLater ? runLater : () => void 0),
    );
  };
}

export function log(msg: string) {
  return contextEffect("log", msg, context => {
    if ((context as any).customLogger !== undefined) {
      (context as any).customLogger(msg);
    } else {
      // tslint:disable-next-line:no-console
      console.log(msg);
    }
  });
}

export function noop() {
  return () => {
    return effect("noop", undefined, () => void 0);
  };
}

export function sendAction<C extends Context<any>, A extends Action<any>>(
  a: A,
) {
  return contextEffect<C, A>("sendAction", undefined, (_c, runLater) =>
    runLater(a),
  );
}
