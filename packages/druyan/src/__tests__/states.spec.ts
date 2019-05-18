import { Enter } from "../Action";
import { currentState, execute, StateDidNotRespondToAction } from "../Context";
import { noop } from "../effects";
import { StateReturn } from "../types";

// import { Context as BaseContext } from "../Context";

function emptyContext() {
  return {
    history: ["Entry"],
  };
}

type Context = ReturnType<typeof emptyContext>;

export async function Entry(action: Enter): Promise<StateReturn<Context>> {
  switch (action.type) {
    case "Enter":
      return noop();
  }
}

const States = {
  Entry,
};

function getCurrentState(c: Context) {
  return currentState(c, States);
}

test("should start in the state last in the history list", () => {
  expect(getCurrentState(emptyContext())).toBe(Entry);
});

test("should throw exception when getting invalid action", async () => {
  await expect(
    execute({ type: "Fake" } as any, Entry, emptyContext(), () => void 0),
  ).rejects.toThrow(StateDidNotRespondToAction);
});
