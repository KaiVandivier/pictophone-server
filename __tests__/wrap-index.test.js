const wrapIndex = require("../lib/wrap-index");

test("it wraps negative indices", () => {
  expect(wrapIndex(-1,3)).toBe(2);
})

test("it wraps index = -length", () => {
  expect(wrapIndex(-3, 3)).toBe(0);
})

test("it wraps positive indices", () => {
  expect(wrapIndex(5, 3)).toBe(2);
})