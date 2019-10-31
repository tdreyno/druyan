import { Subscription } from "@tdreyno/pretty-please";
import { Action, onFrame } from "./action";

export function onFrameSubscription<A extends Action<any>>(
  actionCreator: (ts: number) => A = ts => (onFrame(ts) as unknown) as A,
): Subscription<A> {
  const sub = new Subscription<A>();

  let shouldContinue = false;

  function tick(ts: number) {
    if (!shouldContinue) {
      return;
    }

    sub.emit(actionCreator(ts));

    requestAnimationFrame(tick);
  }

  sub.onStatusChange(status => {
    switch (status) {
      case "active":
        shouldContinue = true;
        tick(performance.now());
        break;

      case "inactive":
        shouldContinue = false;
        break;
    }
  });

  return sub;
}
