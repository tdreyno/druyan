import serializeJavascript from "serialize-javascript";
import { Enter, enter, Exit } from "../actions";
import {
  execute,
  getCurrentState,
  initialContext,
  StateDidNotRespondToAction,
} from "../Context";
import { goBack, log, noop, reenter } from "../effects";
import { Context, wrapState } from "../types";

describe("States", () => {
  const Entry = wrapState((action: Enter) => {
    switch (action.type) {
      case "Enter":
        return noop();
    }
  }, "Entry");

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
    const A = wrapState((action: Enter) => {
      switch (action.type) {
        case "Enter":
          return [log("Enter A"), B()];
      }
    }, "A");

    const B = wrapState((action: Enter) => {
      switch (action.type) {
        case "Enter":
          return [log("Enter B"), C()];
      }
    }, "B");

    const C = wrapState((action: Enter) => {
      switch (action.type) {
        case "Enter":
          return log("Entered C");
      }
    }, "C");

    const results = await execute(enter(), {
      history: [A()],
    });

    expect(results).toBeInstanceOf(Array);

    const gotos = results.filter(r => r.label === "entered");
    expect(gotos).toHaveLength(3);

    const gotoLogs = results.filter(
      r => r.label === "log" && r.data.match(/^Enter:/),
    );
    expect(gotoLogs).toHaveLength(3);

    const normalLogs = results.filter(
      r => r.label === "log" && r.data.match(/^Enter /),
    );
    expect(normalLogs).toHaveLength(2);
  });
});

describe("Exit events", () => {
  test("should fire exit events", async () => {
    const A = wrapState((action: Enter | Exit) => {
      switch (action.type) {
        case "Enter":
          return [log("Enter A"), B()];

        case "Exit":
          return log("Exit A");
      }
    }, "A");

    const B = wrapState((action: Enter | Exit) => {
      switch (action.type) {
        case "Enter":
          return noop();

        case "Exit":
          return log("Exit B");
      }
    }, "B");

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

  const A = wrapState(
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
    "A",
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

  const A = wrapState((action: Enter, _name: string) => {
    switch (action.type) {
      case "Enter":
        return noop();
    }
  }, "A");

  const B = wrapState((action: Enter | GoBack) => {
    switch (action.type) {
      case "Enter":
        return noop();

      case "GoBack":
        return goBack();
    }
  }, "B");

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
    expect(context.history[0].args[0]).toBe("Test");
  });
});

describe("Serialization", () => {
  test("should be able to serialize and deserialize state", async () => {
    interface Next {
      type: "Next";
    }

    const A = wrapState((action: Enter) => {
      switch (action.type) {
        case "Enter":
          return B({ name: "Test" });
      }
    }, "A");

    const B = wrapState((action: Enter | Next, { name }: { name: string }) => {
      switch (action.type) {
        case "Enter":
          return noop();

        case "Next":
          return C(name);
      }
    }, "B");

    const C = wrapState((action: Enter, _name: string) => {
      switch (action.type) {
        case "Enter":
          return noop();
      }
    }, "C");

    function serializeContext(c: Context) {
      return serializeJavascript(
        c.history.map(({ args, name }) => {
          return {
            args,
            name,
          };
        }),
      );
    }

    const STATES = { A, B, C };

    function deserializeContext(s: string) {
      // tslint:disable-next-line: no-eval
      const unboundHistory: Array<{ args: any[]; name: string }> = eval(
        "(" + s + ")",
      );

      return initialContext(
        unboundHistory.map(({ args, name }) => {
          return (STATES as any)[name](...args);
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
    expect(getCurrentState(newContext)!.args[0]).toBe("Test");
  });
});
