const timePhase = require("../lib/time-phase");

// Use fake timers
jest.useFakeTimers();
const callback = jest.fn();

test("The timer times", async () => {
  const promise = timePhase(callback, 1);
  jest.runAllTimers();
  expect(callback.mock.calls.length).toBe(2); // 1 and 0
  expect(callback.mock.calls[0][0]).toBe(1); // first call
  expect(callback.mock.calls[1][0]).toBe(0); // second call
  expect(promise).resolves.toBe(true);
});
