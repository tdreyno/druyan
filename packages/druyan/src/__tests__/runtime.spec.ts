import { Enter, enter, typedAction } from "../action";
import { createInitialContext as originalCreateInitialContext } from "../context";
import { effect, noop, wait } from "../effect";
import { eventually } from "../eventualAction";
import { Runtime } from "../runtime";
import { state, StateTransition } from "../state";

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

describe("Effect can return an action", () => {
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
          return wait(trigger, async () => undefined);

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
