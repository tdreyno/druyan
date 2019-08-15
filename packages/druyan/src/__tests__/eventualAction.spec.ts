import { enter, Enter } from "../action";
import { History } from "../context";
import {
  createInitialContext as originalCreateInitialContext,
  execute,
} from "../core";
import { noop } from "../effect";
import { EventualAction, eventually } from "../eventualAction";
import { state } from "../state";

function createInitialContext(history: History, options = {}) {
  return originalCreateInitialContext(history, {
    disableLogging: true,
    ...options,
  });
}

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

    const context = createInitialContext([A()], {
      allowUnhandled: false,
    });

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
