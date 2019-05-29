import { Enter, enter, Exit } from "../Action";
import {
  currentState,
  execute,
  goto,
  StateDidNotRespondToAction,
} from "../Context";
import { log, noop } from "../effects";

function runLater() {
  return void 0;
}

test("should start in the state last in the history list", () => {
  function Entry(action: Enter) {
    switch (action.type) {
      case "Enter":
        return noop();
    }
  }

  expect(
    currentState({
      history: ["Entry"],
      states: { Entry },
      actions: {},
    }),
  ).toBe(Entry);
});

test("should throw exception when getting invalid action", async () => {
  function Entry(action: Enter) {
    switch (action.type) {
      case "Enter":
        return noop();
    }
  }

  await expect(
    execute(
      { type: "Fake" } as any,
      Entry,
      {
        history: ["Entry"],
        states: { Entry },
        actions: {},
      },
      runLater,
      false,
    ),
  ).rejects.toThrow(StateDidNotRespondToAction);
});

test("should not throw exception when allowing invalid actions", async () => {
  function Entry(action: Enter) {
    switch (action.type) {
      case "Enter":
        return noop();
    }
  }

  expect(
    await execute(
      { type: "Fake" } as any,
      Entry,
      {
        history: ["Entry"],
        states: { Entry },
        actions: {},
      },
      runLater,
      true,
    ),
  ).toHaveLength(0);
});

test("should flatten nested gotos", async () => {
  function A(action: Enter) {
    switch (action.type) {
      case "Enter":
        return [log("Enter A"), goto(B)];
    }
  }

  function B(action: Enter) {
    switch (action.type) {
      case "Enter":
        return [log("Enter B"), goto(C)];
    }
  }

  function C(action: Enter) {
    switch (action.type) {
      case "Enter":
        return log("Enter C");
    }
  }

  const results = await execute(
    enter(),
    A,
    {
      history: [],
      states: { A, B, C },
      actions: {},
    },
    runLater,
    true,
  );

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

test("should fire exit events", async () => {
  function A(action: Enter | Exit) {
    switch (action.type) {
      case "Enter":
        return [log("Enter A"), goto(B)];

      case "Exit":
        return log("Exit A");
    }
  }

  function B(action: Enter) {
    switch (action.type) {
      case "Enter":
        return noop();
    }
  }

  const results = await execute(
    enter(),
    A,
    {
      history: ["A"],
      states: { A, B },
      actions: {},
    },
    runLater,
    true,
  );

  expect(results).toBeInstanceOf(Array);
  expect(results[0]).toMatchObject({ label: "log", data: "Enter A" });
  expect(results[1]).toMatchObject({ label: "log", data: "Exit A" });
  expect(results[2]).toMatchObject({ label: "log", data: "Goto: B" });
});
