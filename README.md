# Druyan

Druyan is a small library for building state machines that can effectively manage complex sequences of events.

## Install

For React, see `@druyan/druyan-react`

For Node.js and other client-side libraries:

```bash
yarn add @druyan/druyan-core
```

## Design

Druyan attempts to provide an API that is "Just Javascript" and operates in a pure and functional manner[^1].

States are simply functions which accept two parameters:

1. `action` which is the event we want to apply to the current state. The action is an object which provides a `type` key to differentiate itself from other action types. It is very similar to a Redux action in format.

2. The current `context` which is an object which holds information about the current session AND the current state of variables being used by the machine.

States return one or more side-effects (or a Promise of one or more side-effects), which are simply functions which will be called in the order they were generated at the end of the state transition.

States can be `enter`ed by sending the `Enter` action. Here is an example of a simple state which logs a message upon entering.

```javascript
function MyState(action, context) {
  switch (action.type) {
    case "Enter":
      return log("Entered state MyState.");
  }
}
```

In this case, `log` is a side-effect which will log to the console. It is implemented like so:

```
const log = (message) => () => console.log(message);
```

This level of indirection, returning a function that will cause an action, rather than immediately executing the action, gives us some interesting abilities.

First, all of our states are pure functions, even if they will eventually communicate with external systems. This allows for very easy testing of state logic.

Second, external middleware can see the requested side-effects and modify them if necessary. Say you can one side-effect to update a user's first name via an HTTP POST to the server and you had a second side-effect to update their last name. Because we can modify the list (and implementations) of the effects before they run, we could write middleware to combine those two effects into 1-single HTTP POST.

## Examples

See the `packages/examples` folder for larger examples.

### Let's play pong.

This example shows how we would model something like a game of Pong.

```javascript
function Welcome(action) {
  switch (action.name) {
    case "Start":
      return goto(Playing);
  }
}

function Playing(action, context) {
  switch (action.name) {
    case "Enter":
      return [
        set({
          ballPosition: [0, 0],
          ballVector: [1, 1],
          leftPaddle: 0,
          leftRight: 0,
        }),
        sendAction(onFrame()),
      ];

    case "OnPaddleInput":
      return [
        set({
          [action.whichPaddle]: context[action.whichPaddle] + action.direction,
        }),
      ];

    case "OnFrame":
      // Handle bouncing off things.
      if (doesIntersectPaddle(context) || doesTopOrBottom(context)) {
        return [
          set({
            ballVector: [
              context.ballVector[0] * -1,
              context.ballVector[1] * -1,
            ],
          }),
          sendAction(onFrame()),
        ];
      }

      // Handle scoring
      if (isOffscreen(context)) {
        return [
          set({
            winner: context.ballPosition < 0 ? "Left" : "Right",
          }),
          goto(Victory),
        ];
      }

      // Otherwise run physics
      return [
        set({
          ballPosition: [
            context.ballPosition[0] + context.ballVector[0],
            context.ballPosition[1] + context.ballVector[1],
          ],
        }),
        sendAction(onFrame()),
      ];
  }
}

function Victory(action, context) {
  switch (action.name) {
    case "Enter":
      return log(`Winner is ${context.winner}`);
  }
}
```

There are a couple of new concepts in here.

1. `set` is used for modifying `context`.
2. `sendAction` is used for triggering an action _after_ the side-effects are run.
3. `onFrame` is simply an action that is called via `requestAnimationFrame`

Our renderer can now check the current state each frame and decide whether to render the Welcome screen, the Victory screen or the game of Pong.

## Technical details

Druyan is implemented in TypeScript and is distributed with `.d.ts` files.

## License

Apache 2.0

[^1]: Internally there is some data mutation, but this can be replaced by a more immutable approach if necessary without modifying the external API.
