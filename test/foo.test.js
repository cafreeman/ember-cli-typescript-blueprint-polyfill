function add(a, b) {
  return a + b;
}

test('adds', () => {
  expect(add(1, 2)).toBe(3);
});
