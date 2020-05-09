const { hardWords, getRandom } = require("./words");
const { DRAW_TIME, GUESS_TIME, COUNTDOWN_TIME } = require("./constants");
const msgs = require("./messages");

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

function wrapIndex(i, len) {
  // "modulo with floor" operator
  return ((i % len) + len) % len;
}

module.exports = async function runGame(socket, io, room) {
  let phasesElapsed = 0;
  room.clearReadies();
  io.to(room.id).emit(msgs.ROOM_UPDATE, room);

  const sockets = {};
  await io.in(room.id).clients((err, clients) => {
    if (err) throw err;
    clients.forEach((id) => (sockets[id] = io.in(room.id).connected[id]));
  });

  // The above `sockets` didn't work one time, and this is a janky fix:
  // const sockets = io.in(room.id).connected;

  // Initiate word-choosing phase:
  // Start the game by giving players a choice of words to draw
  const roomWords = getRandom(hardWords, room.players.length * 6);
  room.players.forEach((player) => {
    const words = roomWords.splice(-6);
    const playerSocket = sockets[player.id];

    // Prepare listeners for next phase
    playerSocket.once("word-chosen", (word) => {
      player.replayData.word = word;
      player.ready = true;
      io.to(room.id).emit(msgs.ROOM_UPDATE, room);

      if (playerSocket.id === room.creatorId) {
        playerSocket.once("continue", async () => {
          // handle notAllReady here
          room.clearReadies();

          // The following is basically `initiateDrawingPhase()`

          // test out a countdown before next phase:
          await countdown(COUNTDOWN_TIME, "Get ready to draw!");

          room.players.forEach((player) => {
            sockets[player.id].once("drawing-phase-loaded", () => {
              // could be renamed to just "ready"?
              // Wait for all clients to load
              player.ready = true;
              if (room.isAllReady()) {
                room.clearReadies();
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

    // Start the word-choosing phase
    io.to(player.id).emit("choose-word", words);
  });

  async function countdown(seconds, message) {
    io.to(room.id).emit("countdown", message);
    return await timePhase(
      (time) => io.to(room.id).emit("time", time),
      seconds
    ).catch((err) => console.log(err));
  }

  async function handleDrawingPhaseLoaded() {
    // Time phase: let players draw for the duration
    await timePhase(
      (seconds) => io.to(room.id).emit("time", seconds),
      DRAWING_TIME // TODO: 90 seconds in production
    ).catch((err) => console.log(err));

    // Prepare to receive drawings at round end
    room.players.forEach((player, idx) => {
      sockets[player.id].once("image-data", (dataURL) => {
        // We want to send this to another player's replayData
        const targetIndex = wrapIndex(idx - phasesElapsed, room.players.length);
        const playerToSendDataTo = room.players[targetIndex];
        playerToSendDataTo.replayData.rounds.push({
          type: "drawing",
          data: dataURL,
          playerName: player.name || player.id,
        });
        player.ready = true;
        if (room.isAllReady()) {
          room.clearReadies();
          phasesElapsed++;
          // distribute drawings for guessing phase
          initiateGuessPhase();
        }
      });
    });

    // End round
    // TODO: could this use an `ack()` to get image data instead?
    io.to(room.id).emit("drawing-time-up");
  }

  async function initiateGuessPhase() {
    await countdown(COUNTDOWN_TIME, "Time to guess!");
    room.players.forEach((player, idx) => {
      // Set up handler for next phase
      sockets[player.id].once("guessing-phase-loaded", () => {
        // message could be renamed to "ready"?
        // Wait for all clients to load
        player.ready = true;
        if (room.isAllReady()) {
          room.clearReadies();
          handleGuessingPhaseLoaded();
        }
      });

      // send image from previous player's drawing (shifted by `phasesElapsed`)
      const index = wrapIndex(idx - phasesElapsed, room.players.length);
      const rounds = room.players[index].replayData.rounds;
      const data = rounds[rounds.length - 1].data;

      sockets[player.id].emit("load-guessing-phase", data);
    });
  }

  async function handleGuessingPhaseLoaded() {
    // Time the guessing phase
    await timePhase(
      (seconds) => io.to(room.id).emit("time", seconds),
      GUESSING_TIME
    ).catch((err) => console.log(err));

    // Prepare to receive drawings at round end
    room.players.forEach((player, idx) => {
      sockets[player.id].once("guess-data", (guess) => {
        const targetIndex = wrapIndex(idx - phasesElapsed, room.players.length);
        const playerToSendDataTo = room.players[targetIndex];
        playerToSendDataTo.replayData.rounds.push({
          type: "guess",
          data: guess,
          playerName: player.name || player.id,
        });

        player.ready = true;
        if (room.isAllReady()) {
          room.clearReadies();
          if (++phasesElapsed >= 4) {
            // TODO: Production change check to /* (room.players.length % 2 === 0 ? room.players.length : room.players.length - 1) */
            // Update room data to load replay
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

  async function initiateDrawingPhase() {
    await countdown(5, "Get ready to draw!");
    room.players.forEach((player, idx) => {
      // Set up handler for next phase
      sockets[player.id].once("drawing-phase-loaded", () => {
        // Wait for all clients to load
        player.ready = true;
        if (room.isAllReady()) {
          room.clearReadies();
          handleDrawingPhaseLoaded();
        }
      });

      // TODO: Refactor this to handle the first round, when the data is just the same player's WORD
      // phasesElapsed === 0 ? player.replayData.word : data

      // send guess from previous player
      const index = wrapIndex(idx - phasesElapsed, room.players.length);
      const rounds = room.players[index].replayData.rounds;
      const data = rounds[rounds.length - 1].data;

      sockets[player.id].emit("load-drawing-phase", data);
    });
  }
};
