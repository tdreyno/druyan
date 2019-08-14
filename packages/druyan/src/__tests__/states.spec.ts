import serializeJavascript from "serialize-javascript";
import { Enter, enter, Exit } from "../action";
import { Context } from "../context";
import { createInitialContext, execute, getCurrentState } from "../core";
import { goBack, log, noop, reenter } from "../effect";
import { StateDidNotRespondToAction } from "../errors";
import { EventualAction, eventually } from "../eventualAction";
import { state } from "../state";

describe("States", () => {
  const Entry = state("Entry", (action: Enter) => {
    switch (action.type) {
      case "Enter":
        return noop();
    }
  });

  test("should allow custom state name", () => {
    expect(Entry.name).toBe("Entry");
  });

  test("should start in the state last in the history list", () => {
    expect(
      getCurrentState({
        history: [Entry()],
      })!.name,
    ).toBe("Entry");
  });

  test("should throw exception when getting invalid action", async () => {
    await expect(
      execute(
        { type: "Fake" },
        {
          history: [Entry()],
          allowUnhandled: false,
        },
      ),
    ).rejects.toThrow(StateDidNotRespondToAction);
  });

  test("should not throw exception when allowing invalid actions", async () => {
    expect(
      await execute(
        { type: "Fake" },
        {
          history: [Entry()],
          allowUnhandled: true,
        },
      ),
    ).toHaveLength(0);
  });
});

describe("Transitions", () => {
  test("should flatten nested state transitions", async () => {
    const A = state("A", (action: Enter) => {
      switch (action.type) {
        case "Enter":
          return [log("Enter A"), B()];
      }
    });

    const B = state("B", (action: Enter) => {
      switch (action.type) {
        case "Enter":
          return [log("Enter B"), C()];
      }
    });

    const C = state("C", (action: Enter) => {
      switch (action.type) {
        case "Enter":
          return log("Entered C");
      }
    });

    const results = await execute(enter(), {
      history: [A()],
    });

    expect(results).toBeInstanceOf(Array);

    const gotos = results.filter(r => r.label === "entered");
    expect(gotos).toHaveLength(3);

    const gotoLogs = results.filter(
      r => r.label === "log" && r.data[0].match(/^Enter:/),
    );
    expect(gotoLogs).toHaveLength(3);

    const normalLogs = results.filter(
      r => r.label === "log" && r.data[0].match(/^Enter /),
    );
    expect(normalLogs).toHaveLength(2);
  });
});

describe("Exit events", () => {
  test("should fire exit events", async () => {
    const A = state("A", (action: Enter | Exit) => {
      switch (action.type) {
        case "Enter":
          return [log("Enter A"), B()];

        case "Exit":
          return log("Exit A");
      }
    });

    const B = state("B", (action: Enter | Exit) => {
      switch (action.type) {
        case "Enter":
          return noop();

        case "Exit":
          return log("Exit B");
      }
    });

    const results = await execute(enter(), {
      history: [A()],
      allowUnhandled: true,
    });

    expect(results).toBeInstanceOf(Array);

    const events = results.filter(r => ["entered", "exited"].includes(r.label));

    expect(events[0]).toMatchObject({ label: "entered", data: { name: "A" } });
    expect(events[1]).toMatchObject({ label: "exited", data: { name: "A" } });
    expect(events[2]).toMatchObject({ label: "entered", data: { name: "B" } });
  });
});

describe("Reenter", () => {
  interface ReEnterReplace {
    type: "ReEnterReplace";
  }

  interface ReEnterAppend {
    type: "ReEnterAppend";
  }

  const A = state(
    "A",
    (action: Enter | Exit | ReEnterReplace | ReEnterAppend) => {
      switch (action.type) {
        case "Enter":
          return noop();

        case "Exit":
          return noop();

        case "ReEnterReplace":
          return reenter(true);

        case "ReEnterAppend":
          return reenter(false);
      }
    },
  );

  test("should exit and re-enter the current state, replacing itself in history", async () => {
    const context = {
      history: [A()],
    };

    const results = await execute({ type: "ReEnterReplace" }, context);

    expect(results).toBeInstanceOf(Array);
    expect(context.history).toHaveLength(1);
  });

  test("should exit and re-enter the current state, appending itself to history", async () => {
    const context = {
      history: [A()],
    };

    const results = await execute({ type: "ReEnterAppend" }, context);

    expect(results).toBeInstanceOf(Array);
    expect(context.history).toHaveLength(2);
  });
});

describe("goBack", () => {
  interface GoBack {
    type: "GoBack";
  }

  const A = state("A", (action: Enter, _name: string) => {
    switch (action.type) {
      case "Enter":
        return noop();
    }
  });

  const B = state("B", (action: Enter | GoBack) => {
    switch (action.type) {
      case "Enter":
        return noop();

      case "GoBack":
        return goBack();
    }
  });

  test("should return to previous state", async () => {
    const context = {
      history: [B(), A("Test")],
    };

    const results = await execute({ type: "GoBack" }, context);

    expect(results).toBeInstanceOf(Array);

    const events = results.filter(r => ["entered", "exited"].includes(r.label));

    expect(events[0]).toMatchObject({ label: "exited", data: { name: "B" } });
    expect(events[1]).toMatchObject({ label: "entered", data: { name: "A" } });

    expect(context.history[0].name).toBe("A");
    expect(context.history[0].data[0]).toBe("Test");
  });
});

describe("Serialization", () => {
  test("should be able to serialize and deserialize state", async () => {
    interface Next {
      type: "Next";
    }

    const A = state("A", (action: Enter) => {
      switch (action.type) {
        case "Enter":
          return B({ name: "Test" });
      }
    });

    const B = state("B", (action: Enter | Next, { name }: { name: string }) => {
      switch (action.type) {
        case "Enter":
          return noop();

        case "Next":
          return C(name);
      }
    });

    const C = state("C", (action: Enter, _name: string) => {
      switch (action.type) {
        case "Enter":
          return noop();
      }
    });

    function serializeContext(c: Context) {
      return serializeJavascript(
        c.history.map(({ data, name }) => {
          return {
            data,
            name,
          };
        }),
      );
    }

    const STATES = { A, B, C };

    function deserializeContext(s: string) {
      // tslint:disable-next-line: no-eval
      const unboundHistory: Array<{ data: any[]; name: string }> = eval(
        "(" + s + ")",
      );

      return createInitialContext(
        unboundHistory.map(({ data, name }) => {
          return (STATES as any)[name](...data);
        }),
      );
    }

    const context = {
      history: [A()],
      allowUnhandled: false,
    };

    await execute(enter(), context);

    expect(getCurrentState(context)!.name).toBe("B");
    const serialized = serializeContext(context);

    const newContext = deserializeContext(serialized);

    await execute({ type: "Next" }, newContext);
    expect(getCurrentState(newContext)!.name).toBe("C");
    expect(getCurrentState(newContext)!.data[0]).toBe("Test");
  });
});

describe("Eventual actions", () => {
  test("should provide an effect which can be queried for values and subscribed to", async () => {
    interface Resize {
      type: "Resize";
      width: number;
    }

    const resize = (width: number): Resize => ({ type: "Resize", width });

    let resolve: () => void;

    // tslint:disable-next-line: promise-must-complete
    const promise = new Promise<void>(res => (resolve = res));

    const FINAL_WIDTH = 600;

    const A = state("A", (action: Enter | Resize) => {
      const eventualResize = eventually(resize);

      switch (action.type) {
        case "Enter":
          setTimeout(() => {
            eventualResize(FINAL_WIDTH);
            resolve();
          }, 100);

          return [noop(), eventualResize];

        case "Resize":
          return noop();
      }
    });

    const context = {
      history: [A()],
      allowUnhandled: false,
    };

    const results = await execute(enter(), context);

    const eventualActions = results.filter(r => r.label === "eventualAction");

    expect(eventualActions).toHaveLength(1);

    const eventuality: EventualAction<any, any> = eventualActions[0].data;

    const onAction = jest.fn();

    expect(eventuality.values).toHaveLength(0);

    eventuality.subscribe(onAction);

    await promise;

    expect(onAction).toBeCalledTimes(1);
    expect(eventuality.values).toHaveLength(1);

    const expectedAction = { type: "Resize", width: FINAL_WIDTH };
    expect(eventuality.values[0]).toMatchObject(expectedAction);
    expect(onAction).toBeCalledWith(expectedAction);
  });
});

describe("Type narrowing", () => {
  const A = state("A", (action: Enter, _bool: boolean) => {
    switch (action.type) {
      case "Enter":
        return noop();
    }
  });

  const B = state("B", (action: Enter, _str: string) => {
    switch (action.type) {
      case "Enter":
        return noop();
    }
  });

  const C = state("C", (action: Enter) => {
    switch (action.type) {
      case "Enter":
        return noop();
    }
  });

  const States = { A, B, C };

  const testBool = (_b: boolean) => void 0;
  const testStr = (_s: string) => void 0;
  const testEmptyTuple = (_t: []) => void 0;

  test("should use type narrowing to select correct data type", async () => {
    const currentState: ReturnType<
      typeof States[keyof typeof States]
    > = getCurrentState({
      history: [A(true)],
    })!;

    switch (currentState.name) {
      case "A":
        // Type test
        testBool(currentState.data[0]);

        expect(currentState.data[0]).toBe(true);

        break;
    }

    const currentState2: ReturnType<
      typeof States[keyof typeof States]
    > = getCurrentState({
      history: [B("test")],
    })!;

    switch (currentState2.name) {
      case "B":
        // Type test
        testStr(currentState2.data[0]);

        expect(currentState2.data[0]).toBe("test");

        break;
    }

    const currentState3: ReturnType<
      typeof States[keyof typeof States]
    > = getCurrentState({
      history: [C()],
    })!;

    switch (currentState3.name) {
      case "C":
        // Type test
        testEmptyTuple(currentState3.data);

        expect(currentState3.data).toHaveLength(0);

        break;
    }
  });
});
