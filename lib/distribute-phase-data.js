const wrapIndex = require("./wrap-index");

module.exports = function distributePhaseData(
  room,
  sockets,
  event,
  phasesElapsed
) {
  return Promise.all(
    room.players.map(
      (player, idx) =>
        new Promise((resolve, reject) => {
          // send data from previous player's turn
          const index = wrapIndex(idx - phasesElapsed, room.players.length);
          const [phaseData] = room.players[index].replayData.slice(-1);
          // const data = rd[rd.length - 1].data;

          // sound out data, expecting `ack` to resolve Promise
          sockets[player.id].emit(event, phaseData, resolve);
        })
    )
  );
};
