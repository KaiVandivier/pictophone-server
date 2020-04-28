function startTimer(socket, time) {
  console.log("starting timer");
  let secs = time;
  const timerInterval = setInterval(() => {
    secs--;
    console.log("Time = ", secs);
    socket.emit("time", { time: secs });
    if (secs === 0) { 
      clearInterval(timerInterval);
      socket.emit("timer-done");
    };
  }, 1000);
}

module.exports = { startTimer }