import { Task } from "@tdreyno/pretty-please";
import { Enter, enter, typedAction } from "../action";
import { createInitialContext as originalCreateInitialContext } from "../context";
import { effect, noop } from "../effect";
import { NoStatesRespondToAction } from "../errors";
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
  test("should transition through multiple states", () => {
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

    expect(runtime.currentState().name).toBe("A");

    expect.hasAssertions();

    runtime.run(enter()).fork(jest.fn(), () => {
      expect(runtime.currentState().name).toBe("B");
    });

    jest.runAllTimers();
  });

  test("should run the action returned", () => {
    const trigger = typedAction("Trigger");
    type Trigger = ReturnType<typeof trigger>;

    const A = state("A", (action: Enter | Trigger) => {
      switch (action.type) {
        case "Enter":
          return trigger();

        case "Trigger":
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

    const runtime = Runtime.create(context, ["Trigger"]);

    expect.hasAssertions();

    runtime.run(enter()).fork(jest.fn(), () => {
      expect(runtime.currentState().name).toBe("B");
    });

    jest.runAllTimers();
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

  test("should run fallback", () => {
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

    const runtime = Runtime.create(context, ["Trigger"], Fallback);

    expect.assertions(4);
    expect(runtime.currentState().name).toBe("A");

    runtime.run(enter()).fork(jest.fn(), () => {
      expect(runtime.currentState().name).toBe("A");

      runtime.run(trigger()).fork(jest.fn(), () => {
        expect(runtime.currentState().name).toBe("B");
        expect(runtime.currentState().data[0]).toBe("TestTest");
      });
    });

    jest.runAllTimers();
  });

  test("should run fallback which reenters current state", () => {
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

    const runtime = Runtime.create(context, [], Fallback);

    expect.assertions(4);
    expect(runtime.currentState().name).toBe("A");

    runtime.run(enter()).fork(jest.fn(), () => {
      expect(runtime.currentState().name).toBe("A");

      runtime.run(trigger()).fork(jest.fn(), () => {
        expect(runtime.currentState().name).toBe("A");
        expect(runtime.currentState().data[0]).toBe("TestTest");
      });
    });

    jest.runAllTimers();
  });
});

// tslint:disable-next-line: max-func-body-length
describe("Nested runtimes", () => {
  const trigger = typedAction("Trigger");
  type Trigger = ReturnType<typeof trigger>;

  test("should send action to parents if child cannot handle it", () => {
    const Child = state("Child", (action: Enter) => {
      switch (action.type) {
        case "Enter":
          return noop();
      }
    });

    const Parent = state("Parent", (action: Enter | Trigger) => {
      switch (action.type) {
        case "Enter":
          return noop();

        case "Trigger":
          return ParentB();
      }
    });

    const ParentB = state("ParentB", (action: Enter) => {
      switch (action.type) {
        case "Enter":
          return noop();
      }
    });

    const parentContext = createInitialContext([Parent()]);
    const parentRuntime = Runtime.create(parentContext);

    const childContext = createInitialContext([Child()]);
    const childRuntime = Runtime.create(
      childContext,
      [],
      undefined,
      parentRuntime,
    );

    expect.hasAssertions();

    childRuntime.run(trigger()).fork(jest.fn(), () => {
      expect(childRuntime.currentState().name).toBe("Child");
      expect(parentRuntime.currentState().name).toBe("ParentB");
    });

    jest.runAllTimers();
  });

  test("should error if parent and child cannot handle action", () => {
    const Child = state("Child", (action: Enter) => {
      switch (action.type) {
        case "Enter":
          return noop();
      }
    });

    const Parent = state("Parent", (action: Enter) => {
      switch (action.type) {
        case "Enter":
          return noop();
      }
    });

    const parentContext = createInitialContext([Parent()]);
    const parentRuntime = Runtime.create(parentContext);

    const childContext = createInitialContext([Child()]);
    const childRuntime = Runtime.create(
      childContext,
      [],
      undefined,
      parentRuntime,
    );

    expect.assertions(3);

    childRuntime
      .run(trigger())
      .fork(e => expect(e).toBeInstanceOf(NoStatesRespondToAction), jest.fn());

    jest.runAllTimers();

    expect(childRuntime.currentState().name).toBe("Child");
    expect(parentRuntime.currentState().name).toBe("Parent");
  });

  test("should allow parent actions to fire along with local transition", () => {
    const ChildA = state("ChildA", (action: Enter) => {
      switch (action.type) {
        case "Enter":
          return [trigger(), ChildB()];
      }
    });

    const ChildB = state("ChildB", (action: Enter) => {
      switch (action.type) {
        case "Enter":
          return noop();
      }
    });

    const ParentA = state("ParentA", (action: Enter | Trigger) => {
      switch (action.type) {
        case "Enter":
          return noop();

        case "Trigger":
          return ParentB();
      }
    });

    const ParentB = state("ParentB", (action: Enter) => {
      switch (action.type) {
        case "Enter":
          return noop();
      }
    });

    const parentContext = createInitialContext([ParentA()]);
    const parentRuntime = Runtime.create(parentContext, ["Trigger"]);

    const childContext = createInitialContext([ChildA()]);
    const childRuntime = Runtime.create(
      childContext,
      [],
      undefined,
      parentRuntime,
    );

    expect.hasAssertions();

    childRuntime.run(enter()).fork(jest.fn(), () => {
      expect(childRuntime.currentState().name).toBe("ChildB");
      expect(parentRuntime.currentState().name).toBe("ParentB");
    });

    jest.runAllTimers();
  });
});

// tslint:disable-next-line: max-func-body-length
describe("Tasks", () => {
  const trigger = typedAction("Trigger");
  type Trigger = ReturnType<typeof trigger>;

  const B = state("B", (action: Enter) => {
    switch (action.type) {
      case "Enter":
        return noop();
    }
  });

  test("should run an action with a task", () => {
    const A = state("A", (action: Enter | Trigger) => {
      switch (action.type) {
        case "Enter":
          return Task.of(trigger());

        case "Trigger":
          return B();
      }
    });

    const context = createInitialContext([A()]);

    const runtime = Runtime.create(context, ["Trigger"]);

    expect.hasAssertions();

    runtime.run(enter()).fork(jest.fn(), () => {
      expect(runtime.currentState().name).toBe("B");
    });

    jest.runAllTimers();
  });

  test("should run transition handler result from a task", () => {
    const A = state("A", (action: Enter) => {
      switch (action.type) {
        case "Enter":
          return Task.of(B());
      }
    });

    const context = createInitialContext([A()]);

    const runtime = Runtime.create(context);

    expect.hasAssertions();

    runtime.run(enter()).fork(jest.fn(), () => {
      expect(runtime.currentState().name).toBe("B");
    });

    jest.runAllTimers();
  });

  test("should run a single effect returned by the task", () => {
    const myEffectExecutor = jest.fn();
    const myEffect = effect("myEffect", undefined, myEffectExecutor);

    const A = state("A", (action: Enter) => {
      switch (action.type) {
        case "Enter":
          return Task.of(myEffect);
      }
    });

    const context = createInitialContext([A()]);

    const runtime = Runtime.create(context);

    expect.hasAssertions();

    runtime.run(enter()).fork(jest.fn(), () => {
      expect(myEffectExecutor).toBeCalled();
    });

    jest.runAllTimers();
  });

  test("should run multiple effects returned by the task", () => {
    const myEffectExecutor1 = jest.fn();
    const myEffect1 = effect("myEffect", undefined, myEffectExecutor1);

    const myEffectExecutor2 = jest.fn();
    const myEffect2 = effect("myEffect", undefined, myEffectExecutor2);

    const A = state("A", (action: Enter) => {
      switch (action.type) {
        case "Enter":
          return Task.of([myEffect1, myEffect2]);
      }
    });

    const context = createInitialContext([A()]);

    const runtime = Runtime.create(context);

    expect.hasAssertions();

    runtime.run(enter()).fork(jest.fn(), () => {
      expect(myEffectExecutor1).toBeCalled();
      expect(myEffectExecutor2).toBeCalled();
    });

    jest.runAllTimers();
  });

  test("should run update functions", () => {
    const A = state(
      "A",
      (action: Enter, name: string): StateReturn => {
        switch (action.type) {
          case "Enter":
            return Task.of(A.update(name + name));
        }
      },
    );

    const context = createInitialContext([A("Test")]);

    const runtime = Runtime.create(context);

    expect(context.currentState.data[0]).toBe("Test");

    runtime.run(enter()).fork(jest.fn(), jest.fn());

    jest.runAllTimers();

    expect(context.currentState.data[0]).toBe("TestTest");
  });

  test("should run effects after an update", () => {
    const myEffectExecutor1 = jest.fn();
    const myEffect1 = effect("myEffect", undefined, myEffectExecutor1);

    const A = state(
      "A",
      (action: Enter, name: string): StateReturn => {
        switch (action.type) {
          case "Enter":
            return Task.of([A.update(name + name), myEffect1]);
        }
      },
    );

    const context = createInitialContext([A("Test")]);

    const runtime = Runtime.create(context);

    expect.hasAssertions();

    runtime.run(enter()).fork(jest.fn(), () => {
      expect(myEffectExecutor1).toBeCalled();
    });

    jest.runAllTimers();
  });
});

describe("onContextChange", () => {
  test("should run callback once after changes", () => {
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

    expect.hasAssertions();

    runtime.run(enter()).fork(jest.fn(), () => {
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    jest.runAllTimers();
  });

  test("should run callback once on update", () => {
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

    const runtime = Runtime.create(context, ["Trigger"]);

    const onChange = jest.fn();

    runtime.onContextChange(onChange);

    expect.hasAssertions();

    runtime.run({ type: "Trigger" }).fork(jest.fn(), () => {
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    jest.runAllTimers();
  });
});

describe("Bound actions", () => {
  test("should run sequentially when called at the same time", () => {
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

    const runtime = Runtime.create(context, ["Add", "Multiply"]);

    const onChange = jest.fn();
    runtime.onContextChange(onChange);

    expect.hasAssertions();

    Task.all([
      runtime.run({ type: "Add", amount: 2 } as Add),
      runtime.run({ type: "Multiply", amount: 2 } as Multiply),
      runtime.run({ type: "Add", amount: 3 } as Add),
      runtime.run({ type: "Multiply", amount: 5 } as Multiply),
      runtime.run({ type: "Add", amount: 1 } as Add),
    ]).fork(jest.fn(), () => {
      expect(runtime.currentState().data[0]).toBe(36);
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    jest.runAllTimers();
  });
});
