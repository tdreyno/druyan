// tslint:disable: jsx-no-multiline-js jsx-wrap-multiline
import React from "react";
import { StateContext, States } from "./machine";

export default () => (
  <StateContext.Create
    initialState={States.Initializing({ message: "Loading" }, true)}
  >
    {({ currentState }) => {
      switch (currentState.name) {
        case "Initalizing":
          // tslint:disable-next-line: no-unused-expression
          currentState.data;

          break;

        case "Loading":
          // tslint:disable-next-line: no-unused-expression
          currentState.data;

          break;

        case "Ready":
          // tslint:disable-next-line: no-unused-expression
          currentState.data;

          break;
      }

      const [{ message }] = currentState.data;

      return <h1>Hello. {message}</h1>;
    }}
  </StateContext.Create>
);
