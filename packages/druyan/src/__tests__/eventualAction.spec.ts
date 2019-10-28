import { Task } from "@tdreyno/pretty-please";
import { enter, Enter } from "../action";
import { createInitialContext as originalCreateInitialContext } from "../context";
import { execute } from "../core";
import { noop } from "../effect";
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

describe("Eventual actions", () => {
  test("should provide an effect which can be queried for values and subscribed to", async () => {
    jest.useFakeTimers();

    interface Resize {
      type: "Resize";
      width: number;
    }

    const resize = (width: number): Resize => ({ type: "Resize", width });

    const onResize = jest.fn();

    const FINAL_WIDTH = 600;

    const A = state(
      "A",
      (action: Enter | Resize): StateReturn => {
        const [task, emit] = Task.emitter(resize);

        switch (action.type) {
          case "Enter":
            setTimeout(() => {
              emit(FINAL_WIDTH);
            }, 100);

            return task;

          case "Resize":
            onResize(action.width);

            return noop();
        }
      },
    );

    const context = createInitialContext([A()], {
      allowUnhandled: false,
    });

    expect.hasAssertions();
    execute(enter(), context).fork(jest.fn(), () => {
      jest.runAllTimers();
      expect(onResize).toBeCalledWith(FINAL_WIDTH);
    });
  });
});
