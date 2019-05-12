import React from "react";
import { StateContext } from "./machine";

export default () => (
  <StateContext.Create initialContext={{ message: "Not Loaded" }}>
    {({ context }) => {
      return <h1>Hello. {context.message}</h1>;
    }}
  </StateContext.Create>
);
