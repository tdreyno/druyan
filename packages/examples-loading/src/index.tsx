// tslint:disable: jsx-no-multiline-js jsx-wrap-multiline
import React from "react";
import { StateContext } from "./machine";
import Initializing from "./machine/states/Initializing";

export default () => (
  <StateContext.Create initialState={Initializing({ message: "Loading" })}>
    {({
      currentState: {
        data: [{ message }],
      },
    }) => {
      return <h1>Hello. {message}</h1>;
    }}
  </StateContext.Create>
);
