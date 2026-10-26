import { describe, expect, test } from "vitest";
import { HubAckRequest, HubCommandsResponse, HubEventsRequest } from "./hub";

describe("hub contract", () => {
  test("parses the documented events example and defaults age_ms", () => {
    const body = HubEventsRequest.parse({
      events: [{ hanger: 7, on_rail: true, garment_on: false, seq: 1042 }],
    });
    expect(body.events[0]).toEqual({ hanger: 7, on_rail: true, garment_on: false, age_ms: 0, seq: 1042 });
  });

  test("rejects empty and oversized batches", () => {
    expect(HubEventsRequest.safeParse({ events: [] }).success).toBe(false);
    const event = { hanger: 1, on_rail: true, garment_on: true };
    expect(HubEventsRequest.safeParse({ events: Array(101).fill(event) }).success).toBe(false);
  });

  test("rejects negative ages and hanger 0", () => {
    expect(
      HubEventsRequest.safeParse({ events: [{ hanger: 1, on_rail: true, garment_on: true, age_ms: -1 }] }).success,
    ).toBe(false);
    expect(
      HubEventsRequest.safeParse({ events: [{ hanger: 0, on_rail: true, garment_on: true }] }).success,
    ).toBe(false);
  });

  test("commands carry a valid light pair", () => {
    expect(
      HubCommandsResponse.safeParse({
        commands: [
          { id: 881, hanger: 3, color: "purple", pattern: "steady" },
          { id: 882, hanger: 18, color: "amber", pattern: "breathe" },
        ],
      }).success,
    ).toBe(true);
    expect(
      HubCommandsResponse.safeParse({ commands: [{ id: 1, hanger: 3, color: "amber", pattern: "steady" }] }).success,
    ).toBe(false);
  });

  test("ack needs at least one id", () => {
    expect(HubAckRequest.safeParse({ ids: [881, 882] }).success).toBe(true);
    expect(HubAckRequest.safeParse({ ids: [] }).success).toBe(false);
  });
});
