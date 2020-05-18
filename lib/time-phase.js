function timePhase(tick, seconds) {
  return new Promise((resolve, reject) => {
    if (seconds < 0) return reject("Negative times are invalid");
    let count = seconds;
    tick(count);
    const tickInterval = setInterval(() => {
      if (count === 0) {
        clearInterval(tickInterval);
        return resolve(true);
      }
      tick(--count);
    }, 1000);
  });
}

module.exports = timePhase;
