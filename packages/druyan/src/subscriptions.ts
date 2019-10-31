import { Subscription } from "@tdreyno/pretty-please";
import { OnFrame, onFrame } from "./action";

export function onFrameSubscription(): Subscription<OnFrame> {
  const sub = new Subscription<OnFrame>();

  let shouldContinue = false;

  function tick() {
    if (!shouldContinue) {
      return;
    }

    sub.emit(onFrame());

    requestAnimationFrame(tick);
  }

  sub.onStatusChange(status => {
    switch (status) {
      case "active":
        shouldContinue = true;
        tick();
        break;

      case "inactive":
        shouldContinue = false;
        break;
    }
  });

  return sub;
}
