import constant from "lodash.constant";
import serializeJavascript from "serialize-javascript";
import { Enter, enter, Exit, exit } from "../action";
import {
  Context,
  createInitialContext as originalCreateInitialContext,
} from "../context";
import { execute } from "../core";
import { goBack, log, noop, reenter } from "../effect";
import {
  EnterExitMustBeSynchronous,
  StateDidNotRespondToAction,
  UnknownStateReturnType,
} from "../errors";
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

describe("Druyan core", () => {
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
      expect(createInitialContext([Entry()]).currentState.name).toBe("Entry");
    });

    test("should throw exception when getting invalid action", async () => {
      await expect(
        execute(
          { type: "Fake" },
          createInitialContext([Entry()], {
            allowUnhandled: false,
          }),
        ),
      ).rejects.toThrow(StateDidNotRespondToAction);
    });

    test("should not throw exception when allowing invalid actions", async () => {
      expect(
        await execute(
          { type: "Fake" },
          createInitialContext([Entry()], {
            allowUnhandled: true,
          }),
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

      const results = await execute(enter(), createInitialContext([A()]));

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

      const results = await execute(
        enter(),
        createInitialContext([A()], {
          allowUnhandled: true,
        }),
      );

      expect(results).toBeInstanceOf(Array);

      const events = results.filter(r =>
        ["entered", "exited"].includes(r.label),
      );

      expect(events[0]).toMatchObject({
        label: "entered",
        data: { name: "A" },
      });
      expect(events[1]).toMatchObject({ label: "exited", data: { name: "A" } });
      expect(events[2]).toMatchObject({
        label: "entered",
        data: { name: "B" },
      });
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
      const context = createInitialContext([A()]);

      const results = await execute({ type: "ReEnterReplace" }, context);

      expect(results).toBeInstanceOf(Array);
      expect(context.history).toHaveLength(1);
    });

    test("should exit and re-enter the current state, appending itself to history", async () => {
      const context = createInitialContext([A()]);

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
      const context = createInitialContext([B(), A("Test")]);

      const results = await execute({ type: "GoBack" }, context);

      expect(results).toBeInstanceOf(Array);

      const events = results.filter(r =>
        ["entered", "exited"].includes(r.label),
      );

      expect(events[0]).toMatchObject({ label: "exited", data: { name: "B" } });
      expect(events[1]).toMatchObject({
        label: "entered",
        data: { name: "A" },
      });

      expect(context.currentState.name).toBe("A");
      expect(context.currentState.data[0]).toBe("Test");
    });
  });

  describe("update", () => {
    interface Update {
      type: "Update";
      updater: (...args: Parameters<typeof A>) => ReturnType<typeof update>;
    }

    const A = state(
      "A",
      async (
        action: Enter | Update,
        str: string,
        bool: boolean,
        num: number,
        fn: () => string,
      ): Promise<StateReturn | StateReturn[]> => {
        switch (action.type) {
          case "Enter":
            return noop();

          case "Update":
            return action.updater(str, bool, num, fn);
        }
      },
    );

    const { update } = A;

    test("should pass through original values", async () => {
      const context = createInitialContext([
        A("Test", false, 5, () => "Inside"),
      ]);

      const action: Update = {
        type: "Update",
        updater: (
          str: string,
          bool: boolean,
          num: number,
          fn: () => string,
        ) => {
          return update(str, bool, num, constant(fn));
        },
      };

      await execute(action, context);

      expect(context.currentState.data[0]).toBe("Test");
      expect(context.currentState.data[1]).toBe(false);
      expect(context.currentState.data[2]).toBe(5);
      expect(context.currentState.data[3]()).toBe("Inside");
    });

    test("should update via prodcer function", async () => {
      const context = createInitialContext([
        A("Test", false, 5, () => "Inside"),
      ]);

      const action: Update = {
        type: "Update",
        updater: () => {
          return update(s => s + s, b => !b, n => n * 2, () => () => "Outside");
        },
      };

      await execute(action, context);

      expect(context.currentState.data[0]).toBe("TestTest");
      expect(context.currentState.data[1]).toBe(true);
      expect(context.currentState.data[2]).toBe(10);
      expect(context.currentState.data[3]()).toBe("Outside");
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

      const B = state(
        "B",
        (action: Enter | Next, { name }: { name: string }) => {
          switch (action.type) {
            case "Enter":
              return noop();

            case "Next":
              return C(name);
          }
        },
      );

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

      const context = createInitialContext([A()], {
        allowUnhandled: false,
      });

      await execute(enter(), context);

      expect(context.currentState.name).toBe("B");
      const serialized = serializeContext(context);

      const newContext = deserializeContext(serialized);

      await execute({ type: "Next" }, newContext);
      expect(newContext.currentState.name).toBe("C");
      expect(newContext.currentState.data[0]).toBe("Test");
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
      > = createInitialContext([A(true)]).currentState;

      switch (currentState.name) {
        case "A":
          // Type test
          testBool(currentState.data[0]);

          expect(currentState.data[0]).toBe(true);

          break;
      }

      const currentState2: ReturnType<
        typeof States[keyof typeof States]
      > = createInitialContext([B("test")]).currentState;

      switch (currentState2.name) {
        case "B":
          // Type test
          testStr(currentState2.data[0]);

          expect(currentState2.data[0]).toBe("test");

          break;
      }

      const currentState3: ReturnType<
        typeof States[keyof typeof States]
      > = createInitialContext([C()]).currentState;

      switch (currentState3.name) {
        case "C":
          // Type test
          testEmptyTuple(currentState3.data);

          expect(currentState3.data).toHaveLength(0);

          break;
      }
    });
  });

  describe("Detect immediate enter/exit resolution", () => {
    function timeout(ts: number) {
      return new Promise(resolve => setTimeout(() => resolve(), ts));
    }

    describe("Enter", () => {
      const A = state("A", async (action: Enter) => {
        switch (action.type) {
          case "Enter":
            await timeout(100);

            return noop();
        }
      });

      test("should not throw if async enter when silenced", async () => {
        await expect(
          execute(
            enter(),
            createInitialContext([A()], {
              onAsyncEnterExit: "silent",
            }),
          ),
        ).resolves.not.toThrow();
      });

      test("should throw if async enter when requested", async () => {
        await expect(
          execute(
            enter(),
            createInitialContext([A()], {
              onAsyncEnterExit: "throw",
            }),
          ),
        ).rejects.toThrow(EnterExitMustBeSynchronous);
      });

      test("should warn if async enter when requested", async () => {
        await execute(
          enter(),
          createInitialContext([A()], {
            onAsyncEnterExit: "warn",
          }),
        );

        (expect(console) as any).toHaveWarnedWith(
          "Enter action handler on state A should be synchronous.",
        );
      });
    });

    describe("Exit", () => {
      const A = state("A", async (action: Enter | Exit) => {
        switch (action.type) {
          case "Enter":
            return noop();

          case "Exit":
            await timeout(100);

            return noop();
        }
      });

      test("should not throw if async exit when silenced", async () => {
        await expect(
          execute(
            exit(),
            createInitialContext([A()], {
              onAsyncEnterExit: "silent",
            }),
          ),
        ).resolves.not.toThrow();
      });

      test("should throw if async exit when requested", async () => {
        await expect(
          execute(
            exit(),
            createInitialContext([A()], {
              onAsyncEnterExit: "throw",
            }),
          ),
        ).rejects.toThrow(EnterExitMustBeSynchronous);
      });

      test("should warn if async exit when requested", async () => {
        await execute(
          exit(),
          createInitialContext([A()], {
            onAsyncEnterExit: "warn",
          }),
        );

        (expect(console) as any).toHaveWarnedWith(
          "Exit action handler on state A should be synchronous.",
        );
      });
    });
  });

  describe("Unknown effect", () => {
    test("should throw error on unknown effect", async () => {
      const A = state("A", (action: Enter) => {
        switch (action.type) {
          case "Enter":
            return (() => {
              // fake effect
            }) as any;
        }
      });

      const context = createInitialContext([A()]);

      await expect(execute(enter(), context)).rejects.toThrow(
        UnknownStateReturnType,
      );
    });
  });

  describe("State Args are immutable", () => {
    test.only("should not mutate original data", async () => {
      const A = state("A", async (action: Enter, data: number[]) => {
        switch (action.type) {
          case "Enter":
            data.push(4);

            return B(data);
        }
      });

      const B = state("B", async (action: Enter, _data: number[]) => {
        switch (action.type) {
          case "Enter":
            return noop();
        }
      });

      const originalData = [1, 2, 3];

      const context = createInitialContext([A(originalData)]);

      await execute(enter(), context);

      expect(context.currentState.name).toBe("B");

      expect(originalData).toEqual([1, 2, 3]);

      expect(context.currentState.data[0]).toEqual([1, 2, 3, 4]);
    });
  });
});
