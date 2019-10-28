import { EndOfSequence, Task } from "@tdreyno/pretty-please";
import { Action } from "./action";
import { Context } from "./context";
import { execute, runEffects } from "./core";
import { Effect } from "./effect";
import {
  NoMatchingActionTargets,
  NoStatesRespondToAction,
  StateDidNotRespondToAction,
} from "./errors";
import { BoundStateFn } from "./state";

type ContextChangeSubscriber = (context: Context) => void;

export class Runtime {
  static create(
    context: Context,
    validActionNames: string[] = [],
    fallback?: BoundStateFn<any, any, any>,
    parent?: Runtime,
  ) {
    return new Runtime(context, validActionNames, fallback, parent);
  }

  public validActions: { [key: string]: boolean } = {
    enter: true,
    exit: true,
    onframe: true,
    ontick: true,
  };

  private contextChangeSubscribers: ContextChangeSubscriber[] = [];

  constructor(
    public context: Context,
    validActionNames: string[] = [],
    public fallback?: BoundStateFn<any, any, any>,
    public parent?: Runtime,
  ) {
    this.run = this.run.bind(this);
    this.canHandle = this.canHandle.bind(this);

    this.validActions = validActionNames.reduce((sum, action) => {
      sum[action.toLowerCase()] = true;
      return sum;
    }, this.validActions);
  }

  onContextChange(fn: ContextChangeSubscriber) {
    this.contextChangeSubscribers.push(fn);

    return () => {
      this.contextChangeSubscribers = this.contextChangeSubscribers.filter(
        sub => sub !== fn,
      );
    };
  }

  disconnect() {
    this.contextChangeSubscribers = [];
  }

  currentState() {
    return this.context.currentState;
  }

  currentHistory() {
    return this.context.history;
  }

  canHandle(action: Action<any>): boolean {
    return !!this.validActions[action.type.toLowerCase()];
  }

  // tslint:disable-next-line:max-func-body-length
  run(action: Action<any>): Task<any, Effect[]> {
    // Make sure we're in a valid state.
    this.validateCurrentState();

    // Run the action.
    return this.executeAction(action).tap(effects => {
      runEffects(this.context, effects);

      // Notify subscribers
      this.contextChangeSubscribers.forEach(sub => sub(this.context));
    });
  }

  bindActions<AM extends { [key: string]: (...args: any[]) => Action<any> }>(
    actions: AM,
  ): AM {
    return Object.keys(actions).reduce(
      (sum, key) => {
        sum[key] = (...args: any[]) => {
          try {
            return this.run(actions[key](...args));
          } catch (e) {
            if (e instanceof NoStatesRespondToAction) {
              if (this.context.customLogger) {
                this.context.customLogger([e.toString()], "error");
              } else if (!this.context.disableLogging) {
                // tslint:disable-next-line: no-console
                console.error(e.toString());
              }

              return;
            }

            throw e;
          }
        };

        return sum;
      },
      {} as any,
    ) as AM;
  }

  private validateCurrentState() {
    const runCurrentState = this.currentState();

    if (!runCurrentState) {
      throw new Error(
        `Druyan could not find current state to run action on. History: ${JSON.stringify(
          this.currentHistory()
            .map(({ name }) => name)
            .join(" -> "),
        )}`,
      );
    }
  }

  private tryActionTargets(
    targets: Array<Task<any, Effect[]>>,
  ): Task<any, Effect[]> {
    return Task.trySequence(e => {
      if (e instanceof StateDidNotRespondToAction) {
        // It's okay to not care about ticks
        if (e.action.type === "OnFrame" || e.action.type === "OnTick") {
          return Task.of([]);
        }

        return true;
      }

      return false;
    }, targets).mapError(e => {
      if (e instanceof EndOfSequence) {
        return new NoMatchingActionTargets("No targets matched action");
      }

      return e;
    });
  }

  private executeAction(action: Action<any>): Task<any, Effect[]> {
    const targets = [execute(action, this.context)];
    const attemptedStates = [this.currentState()];

    if (this.fallback) {
      const fallbackState = this.fallback(this.currentState());
      attemptedStates.push(fallbackState);
      targets.push(execute(action, this.context, fallbackState));
    }

    if (this.parent) {
      attemptedStates.push(this.parent.currentState());
      targets.push(this.parent!.run(action));
    }

    return this.tryActionTargets(targets).mapError(e => {
      if (e instanceof NoMatchingActionTargets) {
        return new NoStatesRespondToAction(attemptedStates, action);
      }

      return e;
    });
  }
}
