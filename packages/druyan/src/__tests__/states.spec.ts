import { Enter, enter, Exit } from "../Action";
import {
  Context,
  currentState,
  execute,
  goto,
  StateDidNotRespondToAction,
} from "../Context";
import { log, noop } from "../effects";
import { StateReturn } from "../types";

function runLater() {
  return void 0;
}

test("should start in the state last in the history list", () => {
  async function Entry(action: Enter): Promise<StateReturn<Context>> {
    switch (action.type) {
      case "Enter":
        return noop();
    }
  }

  expect(
    currentState({
      history: ["Entry"],
      states: { Entry },
    }),
  ).toBe(Entry);
});

test("should throw exception when getting invalid action", async () => {
  async function Entry(action: Enter): Promise<StateReturn<Context>> {
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
      },
      runLater,
      false,
    ),
  ).rejects.toThrow(StateDidNotRespondToAction);
});

test("should not throw exception when allowing invalid actions", async () => {
  async function Entry(action: Enter): Promise<StateReturn<Context>> {
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
      },
      runLater,
      true,
    ),
  ).toHaveLength(0);
});

test("should flatten nested gotos", async () => {
  async function A(action: Enter): Promise<StateReturn<Context>> {
    switch (action.type) {
      case "Enter":
        return [log("Enter A"), goto(B)];
    }
  }

  async function B(action: Enter): Promise<StateReturn<Context>> {
    switch (action.type) {
      case "Enter":
        return [log("Enter B"), goto(C)];
    }
  }

  async function C(action: Enter): Promise<StateReturn<Context>> {
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
    },
    runLater,
    true,
  );

  expect(results).toBeInstanceOf(Array);

  const gotos = results.filter(r => r.name === "goto");
  expect(gotos).toHaveLength(2);

  const gotoLogs = results.filter(
    r => r.name === "log" && r.data.match(/^Goto:/),
  );
  expect(gotoLogs).toHaveLength(2);

  const normalLogs = results.filter(
    r => r.name === "log" && r.data.match(/^Enter /),
  );
  expect(normalLogs).toHaveLength(3);
});

test("should fire exit events", async () => {
  async function A(action: Enter | Exit): Promise<StateReturn<Context>> {
    switch (action.type) {
      case "Enter":
        return [log("Enter A"), goto(B)];

      case "Exit":
        return log("Exit A");
    }
  }

  async function B(action: Enter): Promise<StateReturn<Context>> {
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
    },
    runLater,
    true,
  );

  expect(results).toBeInstanceOf(Array);
  expect(results[0]).toMatchObject({ name: "log", data: "Enter A" });
  expect(results[1]).toMatchObject({ name: "log", data: "Exit A" });
  expect(results[2]).toMatchObject({ name: "log", data: "Goto: B" });
});
