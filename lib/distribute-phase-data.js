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
          // send data from previous player
          const index = wrapIndex(idx - phasesElapsed, room.players.length);
          const rd = room.players[index].replayData;
          const data = rd[rd.length - 1].data;
          // sound out data, expecting `ack` to resolve Promise
          sockets[player.id].emit(event, data, resolve);
        })
    )
  );
};
