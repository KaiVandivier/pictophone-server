const { hardWords, getRandom } = require("./words");
const { DRAWING_TIME, GUESSING_TIME, COUNTDOWN_TIME } = require("./constants");
const msgs = require("./messages");
const timePhase = require("./time-phase");
const wrapIndex = require("./wrap-index");
const getDataFromRoom = require("./get-data-from-room");
const distributePhaseData = require("./distribute-phase-data");

module.exports = async function runGame(socket, io, room) {
  room.open = false;
  room.clearReadies();
  io.to(room.id).emit(msgs.ROOM_UPDATE, room);
  let phasesElapsed = 0;

  const sockets = {};
  await io.in(room.id).clients((err, clients) => {
    if (err) throw err;
    clients.forEach((id) => (sockets[id] = io.in(room.id).connected[id]));
  });
  // The above `sockets` didn't work one time, and this is a janky fix:
  // const sockets = io.in(room.id).connected;

  // Prepare listener for host to continue after room has chosen words
  sockets[room.hostId].on("continue", () => {
    if (!room.isAllReady()) return socket.send("Not everyone is ready!");
    sockets[room.hostId].removeAllListeners("continue");
    room.clearReadies();
    playDrawingPhase();
  });

  // Initiate word-choosing phase: (i.e. could be refactored into "Distribute")
  // Start the game by giving players a choice of words to draw
  const roomWords = getRandom(hardWords, room.players.length * 6);
  room.players.forEach((player) => {
    const words = roomWords.splice(-6);
    sockets[player.id].emit("choose-word", words);

    // handle word choice
    sockets[player.id].once("word-chosen", (word) => {
      player.replayData.push({
        type: "word",
        data: word,
        playerName: player.name || player.id,
      });
      player.ready = true;
      io.to(room.id).emit(msgs.ROOM_UPDATE, room);
    });
  });

  // forEach player: countdown(message);
  // await timePhase;...
  function countdown(seconds, message) {
    io.to(room.id).emit("countdown", message);
    return timePhase( // a Promise
      (time) => io.to(room.id).emit("time", time),
      seconds
    ).catch((err) => console.log(err));
  }

  async function playDrawingPhase() {
    await countdown(5, "Get ready to draw!");

    await distributePhaseData(
      room,
      sockets,
      "load-drawing-phase",
      phasesElapsed
    );

    // Time phase: let players draw for the duration
    await timePhase(
      (seconds) => io.to(room.id).emit("time", seconds),
      DRAWING_TIME
    ).catch((err) => console.log(err));

    // End of phase: get drawings, save them in players' replay
    await getDataFromRoom(room, sockets, "drawing", phasesElapsed);
    phasesElapsed++;
    playGuessingPhase();
  }

  async function playGuessingPhase() {
    await countdown(COUNTDOWN_TIME, "Time to guess!");

    await distributePhaseData(
      room,
      sockets,
      "load-guessing-phase",
      phasesElapsed
    );

    // Give players time to guess; update time
    await timePhase(
      (seconds) => io.to(room.id).emit("time", seconds),
      GUESSING_TIME
    ).catch((err) => console.log(err));

    // End of phase: get players' guesses and save in replay
    await getDataFromRoom(room, sockets, "guess", phasesElapsed);

    // Check if game is over
    if (++phasesElapsed >= Math.max(4, room.players.length - 1)) {
      // Update room data to load replay
      room.open = true;
      const gameReplayData = [...room.players];
      room.clearReplayData();
      io.to(room.id).emit(msgs.ROOM_UPDATE, room);
      io.to(room.id).emit(msgs.LOAD_REPLAY, gameReplayData);
      return;
    }

    // If game is not over, go to drawing phase again:
    playDrawingPhase();
  };
};
