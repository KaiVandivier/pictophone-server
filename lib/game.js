// How will I get this socket in here to use?
// sockets are specific to each connection;
// io has a list of sockets
// io.sockets.emit() === io.emit() goes to all sockets
// socket.emit() goes to a specific socket
// socket.broadcast.emit() goes to all sockets BUT the emitter
// Broadcast to ROOMS or NAMESPACES
// Read more at https://socket.io/docs/emit-cheatsheet/

module.exports = function runGame(socket) {
  console.log("Ready to run game!");
  // handleReady logic goes right here;
  // this also gives us a change to track players in this scope here
  // e.g. players = socket.clients.map(...)

  function timePhase(tick, seconds) {
    return new Promise((resolve, reject) => {
      if (seconds < 0) return reject("Negative times are invalid");
      let count = seconds;
      const tickInterval = setInterval(() => {
        if (count < 0) {
          clearInterval(tickInterval);
          return resolve(true);
        }
        tick(count--);
      }, 1000);
    });
  }

  (function handleReady() {
    // Start the game by giving players a choice of words to draw
    // TODO: Save client info for tracking
    // TODO: Get words
    const words = ["apple", "banana", "carrot", "durian", "elephant", "fox"];
    // TODO: Wait for everyone to choose one
    socket.once("word-chosen", handleWordChosen);
    socket.emit("choose-word", { words });
  })();

  function handleWordChosen({ word }) {
    // Receive chosen word, prompt client to load drawing phase
    // TODO: Save word/player info for replay
    // Send each player their own word (different from after guessing round);
    socket.once("drawing-phase-loaded", handleDrawingPhaseLoaded);
    socket.emit("load-drawing-phase", { word });
  }

  async function handleDrawingPhaseLoaded() {
    await timePhase(
      (seconds) => socket.emit("time", { time: seconds }),
      20 // TODO: 90 seconds in production
    ).catch((err) => console.log(err));
    socket.once("image-data", handleImageData);
    socket.emit("drawing-time-up");
  }

  function handleImageData({ dataURL }) {
    // Save players' drawings for replay, then send them to next player to guess
    // TODO: Handle data; make sure drawing comes from PREVIOUS player
    socket.once("guessing-phase-loaded", handleGuessingPhaseLoaded);
    socket.emit("load-guessing-phase", { dataURL });
  }

  async function handleGuessingPhaseLoaded() {
    // run the guessing phase
    await timePhase(
      (seconds) => socket.emit("time", { time: seconds }),
      20
    ).catch((err) => console.log(err));
    socket.once("guess-data", handleGuessData);
    socket.emit("guessing-time-up");
  }

  function handleGuessData({ guess }) {
    // handle guess data: save & send to next player for drawing
    // TODO: Handle game over
    if (false) {
      console.log("Game done!");
      return socket.emit("load-replay"); // TODO: Add replay data
    }
    // TODO: Make sure to get data from PREVIOUS player
    socket.once("drawing-phase-loaded", handleDrawingPhaseLoaded);
    socket.emit("load-drawing-phase", { word: guess });
  }
};

// Can these be made into a reusable function?
/* 
nextPhase({
  off: "drawing-phase-loaded", 
  action: () => await timePhase(), 
  emit: { msg, data }, 
  on: { msg, handler }
})

function nextPhase({ off, action, emit, on }) {
  socket.off(off);
  action();
  socket.emit(emit.msg, emit.data);
  socket.on(on.msg, on.handler);
}

function phasePipe(...args) { }
*/
