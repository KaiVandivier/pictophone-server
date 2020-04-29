const socket = {};

function timePhase(tick, seconds) {
  return new Promise((resolve, reject) => {
    if (seconds < 0) return reject("Negative times are invalid")
    let count = seconds;
    const tickInterval = setInterval(() => {
      if (count < 0) {
        clearInterval(tickInterval);
        return resolve(true);
      };
      tick(count--);
    }, 1000)
  })
}

(async function execute(){
  console.log("start");
  await timePhase(5, console.log);
  console.log("after await");
})();


socket.on("drawing-phase-loaded", async () => {
  // clean up previous phase: `socket.off()`;
  socket.off("drawing-phase-loaded");
  await timePhase((seconds) => socket.emit("time", { time: seconds }), 90)
    .catch(err => console.log(err));
  socket.emit("drawing-time-up");
  socket.on("image-data", handleImageData);
})

function handleImageData(data) {
  socket.off("image-data");
  // handle image data: save image, send to next user
  socket.emit("load-guessing-phase", data); // TODO: make data come from previous player
  socket.on("guessing-phase-loaded", runGuessingPhase);
}

function runGuessingPhase() { // maybe name "handleGuessingPhaseLoaded" for consistency?
  socket.off("guessing-phase-loaded");
  await timePhase((seconds) => socket.emit("time", { time: seconds }), 90)
    .catch(err => console.log(err));
  socket.emit("guessing-time-up");
  socket.on("guess-data", handleGuessData);
}

function handleGuessData(data) {
  
}