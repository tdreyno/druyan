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

  private validActions_: Set<string>;
  private subscriptions_ = new Map<string, () => void>();
  private pendingActions_: [Action<any>, ExternalTask<any, any>][] = [];
  private contextChangeSubscribers_: ContextChangeSubscriber[] = [];
  private immediateId_?: NodeJS.Immediate;

  constructor(
    public context: Context,
    validActionNames: string[] = [],
    public fallback?: BoundStateFn<any, any, any>,
    public parent?: Runtime,
  ) {
    this.run = this.run.bind(this);
    this.canHandle = this.canHandle.bind(this);
    this.chainResults_ = this.chainResults_.bind(this);
    this.flushPendingActions_ = this.flushPendingActions_.bind(this);
    this.handleSubscriptionEffect_ = this.handleSubscriptionEffect_.bind(this);

    this.validActions_ = validActionNames.reduce(
      (sum, action) => sum.add(action.toLowerCase()),
      new Set<string>(),
    );
  }

  onContextChange(fn: ContextChangeSubscriber) {
    this.contextChangeSubscribers_.push(fn);

    return () => {
      this.contextChangeSubscribers_ = this.contextChangeSubscribers_.filter(
        sub => sub !== fn,
      );
    };
  }

  disconnect() {
    this.contextChangeSubscribers_ = [];
  }

  currentState() {
    return this.context.currentState;
  }

  currentHistory() {
    return this.context.history;
  }

  canHandle(action: Action<any>): boolean {
    return this.validActions_.has(action.type.toLowerCase());
  }

  run(action: Action<any>): Task<any, Effect[]> {
    const task = Task.external<any, Effect[]>();

    this.pendingActions_.push([action, task]);

    if (this.immediateId_) {
      clearImmediate(this.immediateId_);
    }

    this.immediateId_ = setImmediate(this.flushPendingActions_);

    return task;
  }

  bindActions<AM extends { [key: string]: (...args: any[]) => Action<any> }>(
    actions: AM,
  ): AM {
    return Object.keys(actions).reduce((sum, key) => {
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
    }, {} as any) as AM;
  }

  private handleSubscriptionEffect_(effect: Effect) {
    switch (effect.label) {
      case "subscribe":
        this.subscriptions_.set(
          effect.data[0],
          effect.data[1].subscribe((a: Action<any>) => this.run(a)),
        );

      case "unsubscribe":
        if (this.subscriptions_.has(effect.data)) {
          this.subscriptions_.get(effect.data)!();
        }
    }
  }

  private chainResults_([effects, tasks]: ExecuteResult): Task<any, Effect[]> {
    runEffects(this.context, effects);

    effects.forEach(this.handleSubscriptionEffect_);

    return Task.sequence(tasks).chain(results => {
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
        return this.chainResults_(joinedResults);
      }

      return Task.of(joinedResults[0]);
    });
  }

  private flushPendingActions_() {
    if (this.pendingActions_.length <= 0) {
      return;
    }

    const [action, task] = this.pendingActions_.shift()!;

    // Make sure we're in a valid state.
    this.validateCurrentState_();

    try {
      return this.chainResults_(this.executeAction_(action)).fork(
        error => {
          task.reject(error);

          this.pendingActions_.length = 0;
        },
        results => {
          task.resolve(results);

          this.flushPendingActions_();
        },
      );
    } catch (e) {
      task.reject(e);

      this.pendingActions_.length = 0;
    }
  }

  private validateCurrentState_() {
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

  private executeAction_(action: Action<any>): ExecuteResult {
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
