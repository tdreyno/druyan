# Druyan

Druyan is a small library for building state machines that can effectively manage complex sequences of events. [Learn more about state machines (and charts).](https://statecharts.github.io)

## Install

For React, see `@druyan/druyan-react`

For Node.js and other client-side libraries:

```bash
yarn add @druyan/druyan
```

## Design

Druyan attempts to provide an API that is "Just Javascript" and operates in a pure and functional manner[^1].

States are simply functions which accept an `action` which is the event we want to apply to the current state. The action is an object which provides a `type` key to differentiate itself from other action types. It is very similar to a Redux action in format.

States return one or more side-effects (or a Promise of one or more side-effects), which are simply functions which will be called in the order they were generated at the end of the state transition.

States can be `enter`ed by sending the `Enter` action. Here is an example of a simple state which logs a message upon entering.

```javascript
function MyState(action) {
  switch (action.type) {
    case "Enter":
      return log("Entered state MyState.");
  }
}
```

In this case, `log` is a side-effect which will log to the console. It is implemented like so:

```
// The side-effect generating function.
function log(msg) {

  // What gets called when effects are being executed.
  return function() {

    // A representation of the effect, but not the execution.
    return effect(
      // An effect name. Helps when writing tests and middleware.
      "log",

      // The data associated with the effect. Also good for tests and middleware.
      msg,

      // Finally, the method which will execute the effect
      () => console.log(msg)
    );
  }
}
```

This level of indirection, returning a function that will cause an action, rather than immediately executing the action, gives us some interesting abilities.

First, all of our states are pure functions, even if they will eventually communicate with external systems. This allows for very easy testing of state logic.

Second, external middleware can see the requested side-effects and modify them if necessary. Say you can one side-effect to update a user's first name via an HTTP POST to the server and you had a second side-effect to update their last name. Because we can modify the list (and implementations) of the effects before they run, we could write middleware to combine those two effects into 1-single HTTP POST.

It is the opinion of this library that "original Redux was right." Simple functions, reducers and switch statements make reasoning about code easy. In the years since Redux was released, folks have many to DRY-up the boilerplate and have only complicated what was a very simple system. We are not interesting in replacing `switch` statements with more complex alternatives. If this causes an additional level of nesting, so be it.

## Examples

See the `packages/examples` folder for larger examples.

### Let's play pong.

This example shows how we would model something like a game of Pong.

```javascript
function Welcome(action) {
  switch (action.type) {
    case "Start":
      return Playing({
        ballPosition: [0, 0],
        ballVector: [1, 1],
        leftPaddle: 0,
        leftRight: 0,
      });
  }
}

function Playing(action, state) {
  switch (action.type) {
    case "Enter":
      return onFrame();

    case "OnPaddleInput":
      return movePaddle(action, state);

    case "OnFrame":
      // Handle bouncing off things.
      if (doesIntersectPaddle(state) || doesTopOrBottom(state)) {
        return [reflectBall(state), onFrame()];
      }

      // Handle scoring
      if (isOffscreen(state)) {
        return Victory(state, winningSide(state));
      }

      // Otherwise run physics
      return [stepPhysics(state), onFrame()];
  }
}

function Victory(action, _state, winner: string) {
  switch (action.type) {
    case "Enter":
      return log(`Winner is ${winner}`);
  }
}
```

#### Helper functions

```javascript
function movePaddle(action, state) {
  return Playing({
    ...state,
    [action.whichPaddle]: state[action.whichPaddle] + action.direction,
  });
}

function reflectBall(state) {
  return Playing({
    ...state,
    ballVector: [state.ballVector[0] * -1, state.ballVector[1] * -1],
  });
}

function winningSide(state) {
  return state.ballPosition < 0 ? "Left" : "Right";
}

function stepPhysics(state) {
  return Playing({
    ...state,
    ballPosition: [
      state.ballPosition[0] + state.ballVector[0],
      state.ballPosition[1] + state.ballVector[1],
    ],
  });
}
```

`onFrame` is an action that is called via `requestAnimationFrame`

Our renderer can now check the current state each frame and decide whether to render the Welcome screen, the Victory screen or the game of Pong.

## Technical details

Druyan is implemented in TypeScript and is distributed with `.d.ts` files.

## License

Apache 2.0

[^1]: Internally there is some data mutation, but this can be replaced by a more immutable approach if necessary without modifying the external API.
