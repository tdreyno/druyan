import { Enter, enter, typedAction } from "../action";
import { createInitialContext as originalCreateInitialContext } from "../context";
import { effect, noop, task } from "../effect";
import { eventually } from "../eventualAction";
import { Runtime } from "../runtime";
import { state, StateReturn, StateTransition } from "../state";

function createInitialContext(
  history: Array<StateTransition<any, any, any>>,
  options = {},
) {
  return originalCreateInitialContext(history, {
    disableLogging: true,
    ...options,
  });
}

describe("Runtime Basics", () => {
  test("should transition through multiple states", async () => {
    const A = state("A", (action: Enter) => {
      switch (action.type) {
        case "Enter":
          return B();
      }
    });

    const B = state("B", (action: Enter) => {
      switch (action.type) {
        case "Enter":
          return noop();
      }
    });

    const context = createInitialContext([A()]);

    const runtime = Runtime.create(context);

    expect(runtime.currentState()!.name).toBe("A");

    await runtime.run(enter());

    expect(runtime.currentState()!.name).toBe("B");
  });
});

describe("Fallbacks", () => {
  const trigger = typedAction("Trigger");
  type Trigger = ReturnType<typeof trigger>;

  const A = state("A", (action: Enter, _name: string) => {
    switch (action.type) {
      case "Enter":
        return noop();
    }
  });

  const B = state("B", (action: Enter, _name: string) => {
    switch (action.type) {
      case "Enter":
        return noop();
    }
  });

  test("should run fallback", async () => {
    const Fallback = state(
      "Fallback",
      (
        action: Trigger,
        currentState: ReturnType<typeof A | typeof B>,
      ): StateReturn => {
        switch (action.type) {
          case "Trigger":
            const [name] = currentState.data;
            return B(name + name);
        }
      },
    );

    const context = createInitialContext([A("Test")]);

    const runtime = Runtime.create(context, Fallback);

    expect(runtime.currentState()!.name).toBe("A");

    await runtime.run(enter());

    expect(runtime.currentState()!.name).toBe("A");

    await runtime.run(trigger());

    expect(runtime.currentState()!.name).toBe("B");
    expect(runtime.currentState()!.data[0]).toBe("TestTest");
  });

  test("should run fallback which reenters current state", async () => {
    const Fallback = state(
      "Fallback",
      (
        action: Trigger,
        currentState: ReturnType<typeof A | typeof B>,
      ): StateReturn => {
        switch (action.type) {
          case "Trigger":
            const [name] = currentState.data;
            return currentState.reenter(name + name);
        }
      },
    );

    const context = createInitialContext([A("Test")]);

    const runtime = Runtime.create(context, Fallback);

    expect(runtime.currentState()!.name).toBe("A");

    await runtime.run(enter());

    expect(runtime.currentState()!.name).toBe("A");

    await runtime.run(trigger());

    expect(runtime.currentState()!.name).toBe("A");
    expect(runtime.currentState()!.data[0]).toBe("TestTest");
  });
});

describe("Effect can return future reactions", () => {
  const trigger = typedAction("Trigger");
  type Trigger = ReturnType<typeof trigger>;

  const B = state("B", (action: Enter) => {
    switch (action.type) {
      case "Enter":
        return noop();
    }
  });

  it("should run the action returned by the effect", async () => {
    const sendActionAfter = effect("sendActionAfter", undefined, async () =>
      trigger(),
    );

    const A = state("A", (action: Enter | Trigger) => {
      switch (action.type) {
        case "Enter":
          return sendActionAfter;

        case "Trigger":
          return B();
      }
    });

    const context = createInitialContext([A()]);

    const runtime = Runtime.create(context);

    const { nextFramePromise } = await runtime.run(enter());

    // Wait for next action to run
    await nextFramePromise;

    expect(runtime.currentState()!.name).toBe("B");
  });

  it("should wrap promise with an action-returning effect", async () => {
    const A = state("A", (action: Enter | Trigger) => {
      switch (action.type) {
        case "Enter":
          return task(async () => trigger());

        case "Trigger":
          return B();
      }
    });

    const context = createInitialContext([A()]);

    const runtime = Runtime.create(context);

    const { nextFramePromise } = await runtime.run(enter());

    // Wait for next action to run
    await nextFramePromise;

    expect(runtime.currentState()!.name).toBe("B");
  });

  it("should wrap promise with an transition handler result", async () => {
    const A = state("A", (action: Enter) => {
      switch (action.type) {
        case "Enter":
          return task(async () => {
            return B();
          });
      }
    });

    const context = createInitialContext([A()]);

    const runtime = Runtime.create(context);

    const { nextFramePromise } = await runtime.run(enter());

    // Wait for next action to run
    await nextFramePromise;

    expect(runtime.currentState()!.name).toBe("B");
  });

  it("should run a single effect returned by the task", async () => {
    const myEffectExecutor = jest.fn();
    const myEffect = effect("myEffect", undefined, myEffectExecutor);

    const A = state("A", (action: Enter) => {
      switch (action.type) {
        case "Enter":
          return task(async () => {
            return myEffect;
          });
      }
    });

    const context = createInitialContext([A()]);

    const runtime = Runtime.create(context);

    const { nextFramePromise } = await runtime.run(enter());

    // Wait for next action to run
    await nextFramePromise;

    expect(myEffectExecutor).toBeCalled();
  });

  it("should run multiple effects returned by the task", async () => {
    const myEffectExecutor1 = jest.fn();
    const myEffect1 = effect("myEffect", undefined, myEffectExecutor1);

    const myEffectExecutor2 = jest.fn();
    const myEffect2 = effect("myEffect", undefined, myEffectExecutor2);

    const A = state("A", (action: Enter) => {
      switch (action.type) {
        case "Enter":
          return task(async () => {
            return [myEffect1, myEffect2];
          });
      }
    });

    const context = createInitialContext([A()]);

    const runtime = Runtime.create(context);

    const { nextFramePromise } = await runtime.run(enter());

    // Wait for next action to run
    await nextFramePromise;

    expect(myEffectExecutor1).toBeCalled();
    expect(myEffectExecutor2).toBeCalled();
  });

  it("should run update functions", async () => {
    const A = state(
      "A",
      (action: Enter, name: string): StateReturn => {
        switch (action.type) {
          case "Enter":
            return task(async () => {
              return A.update(name + name);
            });
        }
      },
    );

    const context = createInitialContext([A("Test")]);

    const runtime = Runtime.create(context);

    expect(context.currentState.data[0]).toBe("Test");

    const { nextFramePromise } = await runtime.run(enter());

    // Wait for next action to run
    await nextFramePromise;

    expect(context.currentState.data[0]).toBe("TestTest");
  });

  it("should run effects after an update", async () => {
    const myEffectExecutor1 = jest.fn();
    const myEffect1 = effect("myEffect", undefined, myEffectExecutor1);

    const A = state(
      "A",
      (action: Enter, name: string): StateReturn => {
        switch (action.type) {
          case "Enter":
            return task(async () => {
              return [A.update(name + name), myEffect1];
            });
        }
      },
    );

    const context = createInitialContext([A("Test")]);

    const runtime = Runtime.create(context);

    const { nextFramePromise } = await runtime.run(enter());

    // Wait for next action to run
    await nextFramePromise;

    expect(myEffectExecutor1).toBeCalled();
  });
});

describe("onContextChange", () => {
  test("should run callback once after changes", async () => {
    const A = state("A", (action: Enter, _name: string) => {
      switch (action.type) {
        case "Enter":
          return noop();
      }
    });

    const context = createInitialContext([A("Test")]);

    const runtime = Runtime.create(context);

    const onChange = jest.fn();

    runtime.onContextChange(onChange);

    const { nextFramePromise } = await runtime.run(enter());

    // Wait for next action to run
    await nextFramePromise;

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  test("should run callback once lone update", async () => {
    interface Trigger {
      type: "Trigger";
    }

    const A = state(
      "A",
      (action: Trigger, name: string): StateReturn => {
        switch (action.type) {
          case "Trigger":
            return A.update(name + name);
        }
      },
    );

    const context = createInitialContext([A("Test")]);

    const runtime = Runtime.create(context);

    const onChange = jest.fn();

    runtime.onContextChange(onChange);

    const { nextFramePromise } = await runtime.run({ type: "Trigger" });

    // Wait for next action to run
    await nextFramePromise;

    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("Eventual actions", () => {
  interface Trigger {
    type: "Trigger";
  }

  const B = state("B", (action: Enter) => {
    switch (action.type) {
      case "Enter":
        return noop();
    }
  });

  test("should listen for eventual actions", async () => {
    const eventuallyTrigger = eventually(() => ({ type: "Trigger" }));

    const A = state("A", (action: Enter | Trigger) => {
      switch (action.type) {
        case "Enter":
          return eventuallyTrigger;

        case "Trigger":
          return B();
      }
    });

    const context = createInitialContext([A()]);

    const runtime = Runtime.create(context);

    await runtime.run(enter());

    expect(runtime.currentState()!.name).toBe("A");

    await eventuallyTrigger();

    expect(runtime.currentState()!.name).toBe("B");
  });

  test("should automatically unsubscribe after leaving initial state", async () => {
    const eventuallyTrigger = eventually(() => ({ type: "Trigger" }));

    const A = state("A", (action: Enter | Trigger) => {
      switch (action.type) {
        case "Enter":
          return eventuallyTrigger;

        case "Trigger":
          return C();
      }
    });

    const C = state("C", (action: Enter | Trigger) => {
      switch (action.type) {
        case "Enter":
          return noop();

        case "Trigger":
          return B();
      }
    });

    const context = createInitialContext([A()]);

    const runtime = Runtime.create(context);

    await runtime.run(enter());

    expect(runtime.currentState()!.name).toBe("A");

    await eventuallyTrigger();

    expect(runtime.currentState()!.name).toBe("C");

    await eventuallyTrigger();

    expect(runtime.currentState()!.name).toBe("C");
  });

  test("should be able to opt-in to global eventual actions", async () => {
    const eventuallyTrigger = eventually(() => ({ type: "Trigger" }), {
      doNotUnsubscribeOnExit: true,
    });

    const A = state("A", (action: Enter | Trigger) => {
      switch (action.type) {
        case "Enter":
          return eventuallyTrigger;

        case "Trigger":
          return C();
      }
    });

    const C = state("C", (action: Enter | Trigger) => {
      switch (action.type) {
        case "Enter":
          return noop();

        case "Trigger":
          return B();
      }
    });

    const context = createInitialContext([A()]);

    const runtime = Runtime.create(context);

    await runtime.run(enter());

    expect(runtime.currentState()!.name).toBe("A");

    await eventuallyTrigger();

    expect(runtime.currentState()!.name).toBe("C");

    await eventuallyTrigger();

    expect(runtime.currentState()!.name).toBe("B");
  });

  test("should not listen for eventual actions, unless returned as an effect", async () => {
    const eventuallyTrigger = eventually(() => ({ type: "Trigger" }));

    const A = state("A", (action: Enter | Trigger) => {
      switch (action.type) {
        case "Enter":
          return noop();

        case "Trigger":
          return B();
      }
    });

    const context = createInitialContext([A()]);

    const runtime = Runtime.create(context);

    await runtime.run(enter());

    expect(runtime.currentState()!.name).toBe("A");

    await eventuallyTrigger();

    expect(runtime.currentState()!.name).toBe("A");
  });
});

describe("Bound actions", () => {
  test("should run sequentially when called at the same time", async () => {
    interface Add {
      type: "Add";
      amount: number;
    }

    interface Multiply {
      type: "Multiply";
      amount: number;
    }

    const A = state(
      "A",
      (action: Enter | Add | Multiply, count: number): StateReturn => {
        switch (action.type) {
          case "Enter":
            return noop();

          case "Add":
            return A.update(count + action.amount);

          case "Multiply":
            return A.update(count * action.amount);
        }
      },
    );

    const context = createInitialContext([A(0)]);

    const runtime = Runtime.create(context);

    const onChange = jest.fn();
    runtime.onContextChange(onChange);

    await Promise.all([
      runtime.run({ type: "Add", amount: 2 } as Add),
      runtime.run({ type: "Multiply", amount: 2 } as Multiply),
      runtime.run({ type: "Add", amount: 3 } as Add),
      runtime.run({ type: "Multiply", amount: 5 } as Multiply),
      runtime.run({ type: "Add", amount: 1 } as Add),
    ]);

    expect(runtime.currentState()!.data[0]).toBe(36);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
