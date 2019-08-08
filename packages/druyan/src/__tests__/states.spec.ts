import { Enter, enter, Exit } from "../actions";
import { currentState, execute, StateDidNotRespondToAction } from "../Context";
import { log, noop } from "../effects";
import { wrapState } from "../types";

describe("States", () => {
  const Entry = wrapState((action: Enter) => {
    switch (action.type) {
      case "Enter":
        return noop();
    }
  }, "Entry");

  test("should start in the state last in the history list", () => {
    expect(
      currentState({
        history: [Entry()],
      }),
    ).toBe(Entry);
  });

  test("should throw exception when getting invalid action", async () => {
    await expect(
      execute({ type: "Fake" } as any, {
        history: [Entry()],
        allowUnhandled: false,
      }),
    ).rejects.toThrow(StateDidNotRespondToAction);
  });

  test("should not throw exception when allowing invalid actions", async () => {
    expect(
      await execute({ type: "Fake" } as any, {
        history: [Entry()],
        allowUnhandled: true,
      }),
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
          return log("Enter C");
      }
    }, "C");

    const results = await execute(enter(), {
      history: [A()],
      allowUnhandled: true,
    });

    expect(results).toBeInstanceOf(Array);

    const gotos = results.filter(r => r.label === "goto");
    expect(gotos).toHaveLength(2);

    const gotoLogs = results.filter(
      r => r.label === "log" && r.data.match(/^Goto:/),
    );
    expect(gotoLogs).toHaveLength(2);

    const normalLogs = results.filter(
      r => r.label === "log" && r.data.match(/^Enter /),
    );
    expect(normalLogs).toHaveLength(3);
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
    expect(results[0]).toMatchObject({ label: "log", data: "Enter A" });
    expect(results[1]).toMatchObject({ label: "log", data: "Exit A" });
    expect(results[2]).toMatchObject({ label: "log", data: "Goto: B" });
  });
});
