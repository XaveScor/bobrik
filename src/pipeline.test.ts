import { describe, expect, test, vi } from "vitest";
import { runSettled, type Task } from "./pipeline.js";

describe("runSettled", () => {
  test("starts tasks one by one in sequential mode", async () => {
    const events: string[] = [];
    let finishFirst!: () => void;
    const firstFinished = new Promise<void>((resolve) => {
      finishFirst = resolve;
    });
    const second = vi.fn(() => events.push("second"));
    const tasks: Task<unknown>[] = [
      async () => {
        events.push("first");
        await firstFinished;
      },
      second,
    ];

    const resultPromise = runSettled({ seq: true }, tasks);
    await vi.waitFor(() => expect(events).toEqual(["first"]));
    expect(second).not.toHaveBeenCalled();

    finishFirst();
    await resultPromise;
    expect(events).toEqual(["first", "second"]);
  });

  test("continues sequential execution after a rejection", async () => {
    const error = new Error("failed");
    const results = await runSettled({ seq: true }, [() => Promise.reject(error), () => "ok"]);

    expect(results).toEqual([
      { status: "rejected", reason: error },
      { status: "fulfilled", value: "ok" },
    ]);
  });

  test("starts all tasks immediately in parallel mode", async () => {
    const task = vi.fn(() => new Promise<void>(() => {}));

    void runSettled({}, [task, task]);

    expect(task).toHaveBeenCalledTimes(2);
  });
});
