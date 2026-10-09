import test from "node:test";
import assert from "node:assert/strict";
import { tripStatusFromDatabase } from "./trip-status.ts";

test("database statuses map to the existing driver workflow", () => {
  assert.equal(tripStatusFromDatabase("Awaiting driver assignment"), "Offered");
  assert.equal(tripStatusFromDatabase("Driver Assigned"), "Accepted");
  assert.equal(tripStatusFromDatabase("At Pickup"), "At Pickup");
  assert.equal(tripStatusFromDatabase("Picked Up"), "Picked Up");
  assert.equal(tripStatusFromDatabase("In Transit"), "In Transit");
  assert.equal(tripStatusFromDatabase("At Delivery"), "At Delivery");
  assert.equal(tripStatusFromDatabase("Delivered"), "Completed");
});

test("declined offers and unknown legacy values cannot unlock trip actions", () => {
  assert.equal(tripStatusFromDatabase("Awaiting driver assignment", true), "Rejected");
  assert.equal(tripStatusFromDatabase("unexpected legacy status"), "Unavailable");
});
