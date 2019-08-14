import { Action, ActionCreator } from "./action";
import { StateTransition } from "./state";

type Subscriber<A extends Action<any>> = (a: A) => void | Promise<any>;

export interface EventualAction<A extends Action<any>, Args extends any[]> {
  (...args: Args): Promise<any[]>;
  isEventualAction: true;
  actionCreator: ActionCreator<A, Args>;
  subscribe: (sub: Subscriber<A>) => () => void;
  values: A[];
  isDead: boolean;
  createdInState?: StateTransition<any, any, any>;
  doNotUnsubscribeOnExit: boolean;
  destroy: () => void;
  clear: () => void;
}

export function isEventualAction(
  a: EventualAction<any, any> | unknown,
): a is EventualAction<any, any> {
  return a && (a as any).isEventualAction;
}

export function eventually<A extends Action<any>, Args extends any[]>(
  a: ActionCreator<A, Args>,
  doNotUnsubscribeOnExit: boolean = false,
): EventualAction<A, Args> {
  let subscribers: Array<Subscriber<A>> = [];

  const trigger = async (...args: Args): Promise<any[]> => {
    const result = a(...args);

    trigger.values.unshift(result);

    return Promise.all(subscribers.map(s => s(result)));
  };

  trigger.values = [] as A[];

  trigger.doNotUnsubscribeOnExit = doNotUnsubscribeOnExit;

  trigger.isEventualAction = true as true; // Force to true primitive type

  trigger.actionCreator = a;

  trigger.subscribe = (fn: Subscriber<A>) => {
    if (trigger.isDead) {
      throw new Error("Cannot subscribe to a dead eventualAction");
    }

    subscribers.push(fn);

    return () => {
      subscribers = subscribers.filter(sub => sub !== fn);
    };
  };

  trigger.isDead = false;

  trigger.destroy = () => {
    trigger.isDead = true;
    subscribers = [];

    trigger.clear();
  };

  trigger.clear = () => {
    trigger.values = [];
  };

  return trigger;
}
