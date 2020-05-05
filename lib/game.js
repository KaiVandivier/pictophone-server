// How will I get this socket in here to use?
// sockets are specific to each connection;
// io has a list of sockets
// io.sockets.emit() === io.emit() goes to all sockets
// socket.emit() goes to a specific socket
// socket.broadcast.emit() goes to all sockets BUT the emitter
// Broadcast to ROOMS or NAMESPACES
// Read more at https://socket.io/docs/emit-cheatsheet/

const { hardWords, getRandom } = require("./words");
const msgs = require("./messages");

module.exports = function runGame(socket, io, room) {
  // this also gives us a change to track players in this scope here
  // e.g. players = socket.clients.map(...)
  // One round === 1 draw phase & 1 guess phase
  console.log("Ready to run game!");
  console.log("Room: ", room);
  let roundsElapsed = 0;
  const replayData = { word: "", rounds: [] };
  let thisRoundData = {};

  // Start the game by giving players a choice of words to draw
  // TODO: Get DIFFERENT words for each player (i.e. get n * 6 words and split up);
  room.players.forEach(player => {
    const words = getRandom(hardWords, 6);
    // TODO: WAIT for everyone to choose one
    socket.once("word-chosen", handleWordChosen);
    io.to(room.id).emit("choose-word", { words });
  })

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

  function handleWordChosen({ word }) {
    // Receive chosen word, prompt client to load drawing phase
    // TODO: Save word/player info for replay
    // Send each player their own word (different from after guessing round);
    replayData.word = word;
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
    thisRoundData.drawing = dataURL;
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
    thisRoundData.guess = guess;
    replayData.rounds.push(thisRoundData);
    thisRoundData = {};
    // TODO: Handle game over
    if (++roundsElapsed >= 2) {
      // TODO: >= Math.floor(numPlayers / 2)
      // TODO: prepare for new game
      return socket.emit("load-replay", { replayData });
    }
    // TODO: Make sure to get data from PREVIOUS player
    socket.once("drawing-phase-loaded", handleDrawingPhaseLoaded);
    socket.emit("load-drawing-phase", { word: guess });
  }
};
