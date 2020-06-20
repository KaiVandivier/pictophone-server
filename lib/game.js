const { hardWords, veryHardWords, getRandom } = require("./words");
const {
  COUNTDOWN_TIME,
  phases,
  countdownMsgs: cdMsgs,
  events,
  phaseTimes,
  dataTypes,
} = require("./constants");
const msgs = require("./messages");
const timePhase = require("./time-phase");
const getDataFromRoom = require("./get-data-from-room");
const distributePhaseData = require("./distribute-phase-data");

module.exports = async function runGame(socket, io, room, options = {}) {
  // `passWordOnOdd`: when there is an odd number of players, whether to draw the word you choose or pass it to the next player
  const { useHarderWords = false, passWordOnOdd = false } = options;
  const passFirstWord = passWordOnOdd && room.players.length % 2 != 0
  let phasesElapsed = passFirstWord ? 1 : 0;

  room.open = false;
  room.clearReadies();
  io.to(room.id).emit(msgs.ROOM_UPDATE, room);
  
  const sockets = {};
  await io.in(room.id).clients((err, clients) => {
    if (err) throw err;
    clients.forEach((id) => (sockets[id] = io.in(room.id).connected[id]));
  });

  // Prepare listener for host to continue after room has chosen words
  sockets[room.hostId].on("continue", () => {
    if (!room.isAllReady()) return socket.send("Not everyone is ready!");
    sockets[room.hostId].removeAllListeners("continue");
    room.clearReadies();
    playPhase(phases.DRAWING);
  });

  // Start the game by giving players a choice of words to draw (refactor into phase?)
  const roomWords = useHarderWords
    ? getRandom(veryHardWords, room.players.length * 6)
    : getRandom(hardWords, room.players.length * 6);
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
    return timePhase(
      // a Promise
      (time) => io.to(room.id).emit("time", time),
      seconds
    ).catch((err) => console.log(err));
  }

  async function playPhase(phase) {
    const { DRAWING, GUESSING } = phases;

    await countdown(COUNTDOWN_TIME, cdMsgs[phase]);

    // send out phase data: drawings or guesses from previous player (or self)
    await distributePhaseData(room, sockets, events[phase], phasesElapsed);

    // Give players time to draw or guess; update time
    await timePhase(
      (seconds) => io.to(room.id).emit("time", seconds),
      phaseTimes[phase]
    ).catch((err) => console.log(err));

    // End of phase: get players' drawings or guesses and save in replay
    await getDataFromRoom(room, sockets, dataTypes[phase], phasesElapsed);

    // If game is over, exit to replay
    ++phasesElapsed;
    // Note: make sure to check for Guessing phase b/c "passWordOnOdd" offset
    if (phase === GUESSING && gameIsOver(phasesElapsed))
      return loadReplay();

    // Continue to next phase
    const nextPhase = phase === GUESSING ? DRAWING : GUESSING;
    playPhase(nextPhase);
  }

  function gameIsOver(phasesElapsed) {
    return phasesElapsed >= Math.max(4, room.players.length - 1);
  }

  function loadReplay() {
    // Update room data to load replay
    room.open = true;
    const gameReplayData = [...room.players];
    room.clearReplayData();
    io.to(room.id).emit(msgs.ROOM_UPDATE, room);
    io.to(room.id).emit(msgs.LOAD_REPLAY, gameReplayData);
  }
};
