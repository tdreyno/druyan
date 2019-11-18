import serializeJavascript from "serialize-javascript";
import { Enter, enter, Exit } from "../action";
import {
  Context,
  createInitialContext as originalCreateInitialContext,
} from "../context";
import { execute } from "../core";
import { goBack, log, noop } from "../effect";
import { StateDidNotRespondToAction, UnknownStateReturnType } from "../errors";
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

    test("should throw exception when getting invalid action", () => {
      expect(() =>
        execute(
          { type: "Fake" },
          createInitialContext([Entry()], {
            allowUnhandled: false,
          }),
        ),
      ).toThrowError(StateDidNotRespondToAction);
    });

    test("should not throw exception when allowing invalid actions", () => {
      expect(() =>
        execute(
          { type: "Fake" },
          createInitialContext([Entry()], {
            allowUnhandled: true,
          }),
        ),
      ).not.toThrowError(StateDidNotRespondToAction);
    });
  });

  describe("Transitions", () => {
    test("should flatten nested state transitions", () => {
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

      const [results] = execute(enter(), createInitialContext([A()]));

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
    test("should fire exit events", () => {
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

      const [results] = execute(
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
      expect(events[1]).toMatchObject({
        label: "exited",
        data: { name: "A" },
      });
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
      (
        action: Enter | Exit | ReEnterReplace | ReEnterAppend,
        bool: boolean,
      ): StateReturn => {
        switch (action.type) {
          case "Enter":
            return noop();

          case "Exit":
            return noop();

          case "ReEnterReplace":
            return A.update(bool);

          case "ReEnterAppend":
            return A.reenter(bool);
        }
      },
    );

    test("should exit and re-enter the current state, replacing itself in history", () => {
      const context = createInitialContext([A(true)]);

      const [results] = execute({ type: "ReEnterReplace" }, context);

      expect(results).toBeInstanceOf(Array);
      expect(context.history).toHaveLength(1);
    });

    test("should exit and re-enter the current state, appending itself to history", () => {
      const context = createInitialContext([A(true)]);

      const [results] = execute({ type: "ReEnterAppend" }, context);

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

    test("should return to previous state", () => {
      const context = createInitialContext([B(), A("Test")]);

      const [results] = execute({ type: "GoBack" }, context);
      expect(results).toBeInstanceOf(Array);

      const events = results.filter(r =>
        ["entered", "exited"].includes(r.label),
      );

      expect(events[0]).toMatchObject({
        label: "exited",
        data: { name: "B" },
      });
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
      (
        action: Enter | Update,
        str: string,
        bool: boolean,
        num: number,
        fn: () => string,
      ): StateReturn | StateReturn[] => {
        switch (action.type) {
          case "Enter":
            return noop();

          case "Update":
            return action.updater(str, bool, num, fn);
        }
      },
    );

    const { update } = A;

    test("should pass through original values", () => {
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
          return update(str, bool, num, fn);
        },
      };

      execute(action, context);

      expect(context.currentState.data[0]).toBe("Test");
      expect(context.currentState.data[1]).toBe(false);
      expect(context.currentState.data[2]).toBe(5);
      expect(context.currentState.data[3]()).toBe("Inside");
    });
  });

  describe("Serialization", () => {
    test("should be able to serialize and deserialize state", () => {
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

      execute(enter(), context);

      expect(context.currentState.name).toBe("B");
      const serialized = serializeContext(context);

      const newContext = deserializeContext(serialized);

      execute({ type: "Next" }, newContext);

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

    test("should use type narrowing to select correct data type", () => {
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

  describe("Unknown effect", () => {
    test("should throw error on unknown effect", () => {
      const A = state("A", (action: Enter) => {
        switch (action.type) {
          case "Enter":
            return (() => {
              // fake effect
            }) as any;
        }
      });

      const context = createInitialContext([A()]);

      expect(() => execute(enter(), context)).toThrowError(
        UnknownStateReturnType,
      );
    });
  });

  describe("State Args are immutable", () => {
    test("should not mutate original data when transitioning", () => {
      const A = state("A", (action: Enter, data: number[]) => {
        switch (action.type) {
          case "Enter":
            data.push(4);

            return B(data);
        }
      });

      const B = state("B", (action: Enter, _data: number[]) => {
        switch (action.type) {
          case "Enter":
            return noop();
        }
      });

      const originalData = [1, 2, 3];

      const context = createInitialContext([A(originalData)]);

      execute(enter(), context);

      expect(context.currentState.name).toBe("B");
      expect(originalData).toEqual([1, 2, 3]);
      expect(context.currentState.data[0]).toEqual([1, 2, 3, 4]);
    });

    test("should not mutate original data when updating", () => {
      const A = state(
        "A",
        (action: Enter, data: number[]): StateReturn => {
          switch (action.type) {
            case "Enter":
              data.push(4);

              return A.update(data);
          }
        },
      );

      const originalData = [1, 2, 3];

      const context = createInitialContext([A(originalData)]);

      execute(enter(), context);

      expect(originalData).toEqual([1, 2, 3]);
      expect(context.currentState.data[0]).toEqual([1, 2, 3, 4]);
    });

    test("should not break functions or instances when making immutable", () => {
      const fnChecker = jest.fn();
      const testFn = () => {
        fnChecker();
      };

      const classChecker = jest.fn();
      class TestClass {
        run() {
          classChecker();
        }
      }

      interface Shared {
        fn: () => void;
        klass: TestClass;
      }

      const A = state(
        "A",
        (action: Enter, shared: Shared): StateReturn => {
          switch (action.type) {
            case "Enter":
              shared.fn();
              shared.klass.run();

              return A.update(shared);
          }
        },
      );

      const instance = new TestClass();
      const originalData = {
        fn: testFn,
        klass: instance,
      };

      const context = createInitialContext([A(originalData)]);

      execute(enter(), context);

      expect(fnChecker).toHaveBeenCalledTimes(1);
      expect(classChecker).toHaveBeenCalledTimes(1);

      expect(context.currentState.data[0].fn).toBe(testFn);
      expect(context.currentState.data[0].klass).toBe(instance);
    });

    test("should mutate original data when enabling mutability", () => {
      const A = state(
        "A",
        (action: Enter, data: number[]): StateReturn => {
          switch (action.type) {
            case "Enter":
              data.push(4);

              return A.update(data);
          }
        },
        { mutable: true },
      );

      const originalData = [1, 2, 3];

      const context = createInitialContext([A(originalData)]);

      execute(enter(), context);

      expect(originalData).toEqual([1, 2, 3, 4]);

      expect(context.currentState.data[0]).toEqual([1, 2, 3, 4]);
    });
  });
});
