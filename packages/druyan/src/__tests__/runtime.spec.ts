import { Enter, enter } from "../action";
import { createInitialContext as originalCreateInitialContext } from "../context";
import { noop } from "../effect";
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
