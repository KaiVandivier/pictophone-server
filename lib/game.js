const { hardWords, getRandom } = require("./words");
const msgs = require("./messages");

// How will I get this socket in here to use?
// sockets are specific to each connection;
// io has a list of sockets
// io.sockets.emit() === io.emit() goes to all sockets
// socket.emit() goes to a specific socket
// socket.broadcast.emit() goes to all sockets BUT the emitter
// Broadcast to ROOMS or NAMESPACES
// Read more at https://socket.io/docs/emit-cheatsheet/

// should this live in runGame() too?
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

// TODO: Remove `io` here; it doesn't need to run every time
function clearReadies(room) {
  room.players.forEach((player) => (player.ready = false));
  io.to(room.id).emit(msgs.ROOM_UPDATE, room);
}

module.exports = function runGame(socket, io, room) {
  // One round === 1 draw phase & 1 guess phase
  console.log("Ready to run game!");
  let phasesElapsed = 0;
  let thisRoundData = {};
  const replayData = { word: "", rounds: [] };
  clearReadies(room, io);

  io.in(room.id).clients((err, clients) => {
    if (err) throw err;
    // console.log(clients); // ["id1", "id2"]
  });

  // TODO:
  // This doesn't filter out clients NOT in the room yet;
  // but each socket has a property `rooms` that can be used
  // to check
  const sockets = io.in(room.id).connected;

  // Start the game by giving players a choice of words to draw
  const roomWords = getRandom(hardWords, room.players.length * 6);
  room.players.forEach((player) => {
    const words = roomWords.splice(-6);
    const playerSocket = sockets[player.id];
    playerSocket.once("word-chosen", (word) => {
      player.replayData.word = word;
      player.ready = true;
      io.to(room.id).emit(msgs.ROOM_UPDATE, room);
      if (playerSocket.id === room.creatorId) {
        playerSocket.once("continue", () => {
          clearReadies(room);
          room.players.forEach((player) => {
            sockets[player.id].once("drawing-phase-loaded", () => {
              // could be renamed?
              // Wait for all clients to load
              player.ready = true;
              if (room.isAllReady()) {
                clearReadies(room);
                handleDrawingPhaseLoaded(); // is this right?
              }
            });
            sockets[player.id].emit(
              "load-drawing-phase",
              player.replayData.word
            );
          });
        });
      }
    });
    io.to(player.id).emit("choose-word", words);

    // should ALL these other handlers live in this loop?
    // One solution is to pass "socket" around to each handler
  });

  // should this live on room?
  function clearReadies(room) {
    room.players.forEach((player) => (player.ready = false));
    io.to(room.id).emit(msgs.ROOM_UPDATE, room);
  }

  function handleWordChosen(word) {
    /**
     * This is partially handled in the `forEach` loop above
     */
    // Receive chosen word, prompt client to load drawing phase
    // Send each player their own word (different from after guessing round);
    replayData.word = word;
    socket.once("drawing-phase-loaded", handleDrawingPhaseLoaded);
    io.to(room.id).emit("load-drawing-phase", word);
  }

  async function handleDrawingPhaseLoaded() {
    // Time phase
    await timePhase(
      (seconds) => io.to(room.id).emit("time", seconds),
      20 // TODO: 90 seconds in production
    ).catch((err) => console.log(err));
    // Prepare to receive drawings at round end
    room.players.forEach((player) => {
      sockets[player.id].once("image-data", (dataURL) => {
        player.replayData.rounds.push({
          type: "drawing",
          data: dataURL,
          player: player.name || player.id,
        });
        player.ready = true;
        if (room.isAllReady()) {
          clearReadies(room);
          phasesElapsed++;
          // distribute drawings for guessing phase
          initiateGuessPhase();
        }
      });
    });
    // End round
    // TODO: could this use an `ack()` instead?
    io.to(room.id).emit("drawing-time-up");
  }

  // copied from "handleImageData"
  function initiateGuessPhase() {
    // for each player,
    // 1. Listen for "ready" (i.e. "-loaded")
    //   a. When everyone is ready, run "handleGuessingPhaseLoaded()"
    //   b. Use similar logic to "handleDrawingPhaseLoaded" to save everyone's data and move on when everyone is ready
    // 2. Emit "load guessing phase" with PREVIOUS player's drawing
    room.players.forEach((player, idx) => {
      // Listen for next phase
      sockets[player.id].once("guessing-phase-loaded", () => {
        // message could be renamed?
        // Wait for all clients to load
        player.ready = true;
        if (room.isAllReady()) {
          clearReadies(room);
          handleGuessingPhaseLoaded(); // is this right?
        }
      });

      // send image from next player's drawing
      const index = (idx + 1) % room.players.length;
      const rounds = room.players[index].replayData.rounds;
      const data = rounds[rounds.length - 1].data;

      sockets[player.id].emit("load-guessing-phase", data);
    });
  }

  async function handleGuessingPhaseLoaded() {
    // Time the guessing phase
    await timePhase(
      (seconds) => io.to(room.id).emit("time", seconds),
      20
    ).catch((err) => console.log(err));
    // Prepare to receive drawings at round end
    room.players.forEach((player) => {
      sockets[player.id].once("guess-data", (guess) => {
        player.replayData.rounds.push({
          type: "guess",
          data: guess,
          player: player.name || player.id,
        });
        
        player.ready = true;
        if (room.isAllReady()) {
          clearReadies(room);
          if (++phasesElapsed >= (room.players.length % 2 === 0 ? room.players.length : room.players.length - 1)) {
            // load replay
            io.to(room.id).emit(msgs.ROOM_UPDATE, room);
            io.to(room.id).emit("load-replay");
            return;
          }
          // distribute guess for drawing phase
          initiateDrawingPhase();
        }
      });
    });
    // End round
    // TODO: could this use an `ack()` instead?
    io.to(room.id).emit("guessing-time-up");
  }

  function initiateDrawingPhase() {
    // for each player,
    // 1. Listen for "ready" (i.e. "-loaded")
    //   a. When everyone is ready, run "handleDrawingPhaseLoaded()"
    //   b. Use similar logic to "handleDrawingPhaseLoaded" to save everyone's data and move on when everyone is ready
    // 2. Emit "load guessing phase" with PREVIOUS player's drawing
    room.players.forEach((player, idx) => {
      // Set up handler for next phase
      sockets[player.id].once("drawing-phase-loaded", () => {
        // Wait for all clients to load
        player.ready = true;
        if (room.isAllReady()) {
          clearReadies(room);
          handleDrawingPhaseLoaded();
        }
      });

      // TODO: Refactor this to handle the first round, when the data is just the same player's WORD
      // phasesElapsed === 0 ? player.replayData.word : data

      // send guess from next player
      const index = (idx + 1) % room.players.length;
      const rounds = room.players[index].replayData.rounds;
      const data = rounds[rounds.length - 1].data;

      sockets[player.id].emit("load-drawing-phase", data);
    });
  }

  function handleGuessData(guess) {
    // handle guess data: save & send to next player for drawing
    thisRoundData.guess = guess;
    replayData.rounds.push(thisRoundData);
    thisRoundData = {};
    // TODO: Handle game over
    if (++roundsElapsed >= 2) {
      // TODO: >= Math.floor(numPlayers / 2)
      // TODO: prepare for new game
      return socket.emit("load-replay", replayData);
    }
    // TODO: Make sure to get data from PREVIOUS player
    socket.once("drawing-phase-loaded", handleDrawingPhaseLoaded);
    socket.emit("load-drawing-phase", guess);
  }
};
