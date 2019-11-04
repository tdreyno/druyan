import { ExternalTask, Task } from "@tdreyno/pretty-please";
import { Action, isAction } from "./action";
import { Context } from "./context";
import { execute, ExecuteResult, processStateReturn, runEffects } from "./core";
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

  private subscriptions = new Map<string, () => void>();
  private pendingActions: Array<[Action<any>, ExternalTask<any, any>]> = [];
  private contextChangeSubscribers: ContextChangeSubscriber[] = [];
  private immediateId?: NodeJS.Immediate;

  constructor(
    public context: Context,
    validActionNames: string[] = [],
    public fallback?: BoundStateFn<any, any, any>,
    public parent?: Runtime,
  ) {
    this.run = this.run.bind(this);
    this.canHandle = this.canHandle.bind(this);
    this.chainResults = this.chainResults.bind(this);
    this.flushPendingActions = this.flushPendingActions.bind(this);

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

  run(action: Action<any>): Task<any, Effect[]> {
    const task = Task.external<any, Effect[]>();

    this.pendingActions.push([action, task]);

    if (this.immediateId) {
      clearImmediate(this.immediateId);
    }

    this.immediateId = setImmediate(this.flushPendingActions);

    return task;
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

  private handleSubscriptionEffects(effects: Effect[]) {
    effects.forEach(effect => {
      switch (effect.label) {
        case "subscribe":
          this.subscriptions.set(
            effect.data[0],
            effect.data[1].subscribe((a: Action<any>) => this.run(a)),
          );

        case "unsubscribe":
          if (this.subscriptions.has(effect.data)) {
            this.subscriptions.get(effect.data)!();
          }
      }
    });
  }

  private chainResults([effects, tasks]: ExecuteResult): Task<any, Effect[]> {
    runEffects(this.context, effects);

    this.handleSubscriptionEffects(effects);

    return Task.sequence(tasks).andThen(results => {
      const joinedResults = results.reduce(
        (sum, item) => {
          if (isAction(item)) {
            sum[1].push(this.run(item));
            return sum;
          } else {
            return processStateReturn(this.context, sum, item);
          }
        },
        [effects, []] as ExecuteResult,
      );

      if (joinedResults[1].length > 0) {
        return this.chainResults(joinedResults);
      }

      return Task.of(joinedResults[0]);
    });
  }

  private flushPendingActions() {
    if (this.pendingActions.length <= 0) {
      return;
    }

    const [action, task] = this.pendingActions.shift()!;

    // Make sure we're in a valid state.
    this.validateCurrentState();

    try {
      return this.executeAction(action)
        .andThen(this.chainResults)
        .fork(
          error => {
            task.reject(error);

            this.pendingActions.length = 0;
          },
          results => {
            task.resolve(results);

            this.flushPendingActions();
          },
        );
    } catch (e) {
      task.reject(e);

      this.pendingActions.length = 0;
    }
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

  private executeAction(action: Action<any>): ExecuteResult {
    // Try this runtime.
    try {
      return execute(action, this.context);
    } catch (e) {
      // If it failed to handle optional actions like OnFrame, continue.
      if (!(e instanceof StateDidNotRespondToAction)) {
        throw e;
      }

      // If we failed the last step by not responding, and we have
      // a fallback, try it.
      if (this.fallback) {
        const fallbackState = this.fallback(this.currentState());

        try {
          return execute(e.action, this.context, fallbackState);
        } catch (e2) {
          if (!(e2 instanceof StateDidNotRespondToAction)) {
            throw e2;
          }

          if (this.parent) {
            try {
              // Run on parent and throw away effects.
              this.parent!.run(e.action);

              return [[], []];
            } catch (e3) {
              if (!(e3 instanceof StateDidNotRespondToAction)) {
                throw e3;
              }

              throw new NoStatesRespondToAction(
                [
                  this.currentState(),
                  fallbackState,
                  this.parent.currentState(),
                ],
                e.action,
              );
            }
          } else {
            throw new NoStatesRespondToAction(
              [this.currentState(), fallbackState],
              e.action,
            );
          }
        }
      }

      if (this.parent) {
        // If we failed either previous step without responding,
        // and we have a parent runtime. Try running that.
        try {
          // Run on parent
          return [[], [this.parent!.run(e.action)]];
        } catch (e3) {
          if (!(e3 instanceof StateDidNotRespondToAction)) {
            throw e3;
          }

          throw new NoStatesRespondToAction(
            [this.currentState(), this.parent.currentState()],
            e.action,
          );
        }
      }

      throw new NoStatesRespondToAction([this.currentState()], e.action);
    }
  }
}
