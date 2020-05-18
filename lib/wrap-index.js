module.exports = function wrapIndex(i, len) {
  // "modulo with floor" operator
  return ((i % len) + len) % len;
}
