import { Action } from "@druyan/druyan";

export interface Update extends Action<"Update"> {}

export function update(): Update {
  return {
    type: "Update",
  };
}
