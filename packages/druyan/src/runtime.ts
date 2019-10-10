import flatten from "lodash.flatten";
import { Action, enter, isAction } from "./action";
import { Context } from "./context";
import { execute, processStateReturns, runEffects } from "./core";
import { Effect, isEffect } from "./effect";
import {
  NoMatchingActionTargets,
  NoStatesRespondToAction,
  StateDidNotRespondToAction,
} from "./errors";
import { EventualAction, isEventualAction } from "./eventualAction";
import {
  BoundStateFn,
  isStateTransition,
  StateReturn,
  StateTransition,
} from "./state";

interface EventualActionsByState {
  [key: string]: Array<EventualAction<any, any>>;
}

type Unsubscriber = () => void;

interface UnSubOnExit {
  [key: string]: Unsubscriber[];
}

type ContextChangeSubscriber = (context: Context) => void;

interface RunReturn {
  context: Context;
  nextFramePromise?: Promise<RunReturn | undefined>;
}

function runNext<T>(run: () => Promise<T>): Promise<T> {
  return new Promise<T>(async resolve => {
    // tslint:disable-next-line: no-typeof-undefined
    if (typeof requestAnimationFrame !== "undefined") {
      requestAnimationFrame(async () => resolve(await run()));
    } else {
      setTimeout(async () => resolve(await run()), 0);
    }
  });
}

export class Runtime {
  static create(
    context: Context,
    validActionNames: string[] = [],
    fallback?: BoundStateFn<any, any, any>,
    parent?: Runtime,
  ) {
    return new Runtime(context, validActionNames, fallback, parent);
  }

  validActions: { [key: string]: boolean } = {
    enter: true,
    exit: true,
    onframe: true,
    ontick: true,
  };

  awaitingTaskPromise?: Promise<RunReturn>;

  private runPromise: Promise<RunReturn> = Promise.resolve<RunReturn>({
    context: this.context,
  });
  private runsInFlight = 0;
  private unsubOnExit: UnSubOnExit = {};
  private contextChangeSubscribers: ContextChangeSubscriber[] = [];

  constructor(
    public context: Context,
    validActionNames: string[] = [],
    public fallback?: BoundStateFn<any, any, any>,
    public parent?: Runtime,
  ) {
    this.run = this.run.bind(this);
    this.runNextFrame = this.runNextFrame.bind(this);
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
  async run(action: Action<any>): Promise<RunReturn> {
    if (this.awaitingTaskPromise) {
      throw new Error("Cannot process new actions until task finishes");
    }

    this.runsInFlight += 1;

    return (this.runPromise = this.runPromise.then(async () => {
      // Make sure we're in a valid state.
      this.validateCurrentState();

      // Run the action.
      const effects = await this.executeAction(action);
      const results = await this.processEffects(effects);

      this.runsInFlight -= 1;

      // Notify subscribers
      if (this.runsInFlight <= 0) {
        this.contextChangeSubscribers.forEach(sub => sub(this.context));
      }

      return results;
    }));
  }

  bindActions<AM extends { [key: string]: (...args: any[]) => Action<any> }>(
    actions: AM,
  ): AM {
    return Object.keys(actions).reduce(
      (sum, key) => {
        sum[key] = async (...args: any[]) => {
          try {
            return await this.run(actions[key](...args));
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

  async processEffects(effects: Effect[]): Promise<RunReturn> {
    const nextActions = effects
      .filter(e => e.label === "runNextAction")
      .map(e => e.data as Action<any>);

    const tasks = effects
      .filter(e => e.label === "task")
      .map(e => e.data as () => Promise<StateReturn | StateReturn[] | void>);

    // Run the resulting effects.
    const results = await runEffects(this.context, effects);

    // Schedule future actions.
    const nextFramePromise = this.scheduleWaitingForNextFrame(
      nextActions,
      results,
      tasks,
    );

    // Find global eventual actions and ones generated by the final
    // state in the transition.
    const eventualActionsByState = this.collectionEventualActions(effects);

    // Subscribe to eventual actions
    this.unsubOnExit = this.subscribeToEventualActions(eventualActionsByState);

    return {
      context: this.context,
      nextFramePromise,
    };
  }

  private async runNextFrame(
    action: Action<any> | undefined,
    transition: StateTransition<any, any, any> | undefined,
    effects: Effect[],
  ): Promise<RunReturn> {
    if (transition) {
      // add to history, run enter
      this.context.history.push(transition);

      await runNext(() => this.run(enter()));
    } else if (action) {
      await runNext(() => this.run(action));
    }

    if (effects.length <= 0) {
      return {
        context: this.context,
      };
    }

    return this.processEffects(effects);
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

  private async tryActionTargets(
    targets: Array<(...args: any[]) => Promise<Effect[]>>,
  ): Promise<Effect[]> {
    if (targets.length <= 0) {
      throw new NoMatchingActionTargets("No targets matched action");
    }

    const [target, ...remainingTargets] = targets;

    try {
      return await target();
    } catch (e) {
      // Handle known error types.
      if (e instanceof StateDidNotRespondToAction) {
        // It's okay to not care about ticks
        if (e.action.type === "OnFrame" || e.action.type === "OnTick") {
          return [];
        }

        return this.tryActionTargets(remainingTargets);
      }

      throw e;
    }
  }

  private async executeAction(action: Action<any>): Promise<Effect[]> {
    const targets = [() => execute(action, this.context)];
    const attemptedStates = [this.currentState()];

    if (this.fallback) {
      const fallbackState = this.fallback(this.currentState());
      attemptedStates.push(fallbackState);
      targets.push(() => execute(action, this.context, fallbackState));
    }

    if (this.parent) {
      attemptedStates.push(this.parent.currentState());

      targets.push(async () => {
        await this.parent!.run(action);

        // We don't care about our parent's effects
        return [];
      });
    }

    try {
      return await this.tryActionTargets(targets);
    } catch (e) {
      if (e instanceof NoMatchingActionTargets) {
        throw new NoStatesRespondToAction(attemptedStates, action);
      }

      throw e;
    }
  }

  private async scheduleWaitingForNextFrame(
    effectActions: Array<Action<any>>,
    results: any[],
    tasks: Array<() => Promise<StateReturn | StateReturn[] | void>>,
  ): Promise<RunReturn | undefined> {
    if (tasks.length > 1) {
      throw new Error("Cannot run more than one concurrent tasks");
    }

    if (tasks.length === 1) {
      this.awaitingTaskPromise = tasks[0]()
        .then(async result => {
          if (result) {
            // Transion can return 1 side-effect, or an array of them.
            const asArray = Array.isArray(result) ? result : [result];
            const effects = await processStateReturns(this.context, asArray);

            return this.processEffects(effects);
          }

          return { context: this.context };
        })
        .finally(() => {
          this.awaitingTaskPromise = undefined;
        });

      return Promise.resolve(undefined);
    }

    const flatResult = flatten(results);
    const resultActions = flatResult.filter(isAction);
    const nextEffects = flatResult.filter(isEffect);
    const nextTransitions = flatResult.filter(isStateTransition);

    const [localNextActions, remoteNextActions] = [
      ...effectActions,
      ...resultActions,
    ].reduce(
      (tuple, action) => {
        const index = this.canHandle(action) ? 0 : 1;
        tuple[index].push(action);
        return tuple;
      },
      [[], []] as [Array<Action<any>>, Array<Action<any>>],
    );

    if (localNextActions.length + nextTransitions.length > 1) {
      throw new Error("Cannot run more than one local `runNextAction`");
    }

    if (remoteNextActions.length > 0) {
      if (this.parent) {
        remoteNextActions.forEach(this.parent.run);
      } else {
        throw new Error(
          "Trying to run actions on a parent runtime, but none exists.",
        );
      }
    }

    // Run a single "next action" in one rAF cycle.
    return this.runNextFrame(
      localNextActions[0],
      nextTransitions[0],
      nextEffects,
    );
  }

  private collectionEventualActions(effects: Effect[]): EventualActionsByState {
    return effects.reduce(
      (sum, effect) => {
        // Store eventual actions by state name.
        if (isEventualAction(effect.data)) {
          sum[effect.data.createdInState!.name] =
            sum[effect.data.createdInState!.name] || [];
          sum[effect.data.createdInState!.name].push(effect.data);

          return sum;
        }

        if (effect.label === "exited") {
          // If non-global eventual actions are exitted in the same
          // transition, clean them up and never subscribe.
          if (sum[effect.data.name]) {
            sum[effect.data.name] = sum[effect.data.name].filter(
              e => e.doNotUnsubscribeOnExit,
            );
          }

          // Unsub those who care about exiting this state.
          if (this.unsubOnExit[effect.data.name]) {
            this.unsubOnExit[effect.data.name].forEach(unsub => unsub());
            delete this.unsubOnExit[effect.data.name];
          }
        }

        return sum;
      },
      {} as EventualActionsByState,
    );
  }

  private subscribeToEventualActions(
    eventualActionsByState: EventualActionsByState,
  ): UnSubOnExit {
    return Object.keys(eventualActionsByState).reduce((sum, stateName) => {
      const eventualActions = eventualActionsByState[stateName];

      for (const eventualAction of eventualActions) {
        const unsubscribe = eventualAction.subscribe(this.run);

        // Make a list of automatic unsubscribes
        if (!eventualAction.doNotUnsubscribeOnExit) {
          sum[stateName] = sum[stateName] || [];
          sum[stateName].push(unsubscribe);
        }
      }

      return sum;
    }, this.unsubOnExit);
  }
}
