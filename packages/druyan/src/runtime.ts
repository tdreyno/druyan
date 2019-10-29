import { Task } from "@tdreyno/pretty-please";
import { Action } from "./action";
import { Context } from "./context";
import { execute, runEffects } from "./core";
import { Effect } from "./effect";
import { NoStatesRespondToAction, StateDidNotRespondToAction } from "./errors";
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

  private executeAction(action: Action<any>): Task<any, Effect[]> {
    const attemptedStates = [this.currentState()];

    // Try this runtime.
    return execute(action, this.context)
      .orElse(e => {
        // If it failed to handle optional actions like OnFrame, continue.
        if (
          e instanceof StateDidNotRespondToAction &&
          (e.action.type === "OnFrame" || e.action.type === "OnTick")
        ) {
          return Task.of([]);
        }

        // Otherwise fail.
        return Task.fail(e);
      })
      .orElse(e => {
        // If we failed the last step by not responding, and we have
        // a fallback, try it.
        if (e instanceof StateDidNotRespondToAction && this.fallback) {
          const fallbackState = this.fallback(this.currentState());
          attemptedStates.push(fallbackState);

          return execute(e.action, this.context, fallbackState);
        }

        // Otherwise continue failing.
        return Task.fail(e);
      })
      .orElse(e => {
        // If we failed either previous step without responding,
        // and we have a parent runtime. Try running that.
        if (e instanceof StateDidNotRespondToAction && this.parent) {
          attemptedStates.push(this.parent.currentState());

          // Run on parent and throw away effects.
          return this.parent!.run(e.action).map(() => []);
        }

        // Otherwise keep failing.
        return Task.fail(e);
      })
      .mapError(e => {
        // If all handlers failed to respond, return a custom
        // error message.
        if (e instanceof StateDidNotRespondToAction) {
          return new NoStatesRespondToAction(attemptedStates, e.action);
        }

        return e;
      });
  }
}
