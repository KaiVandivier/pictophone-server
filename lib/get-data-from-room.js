const wrapIndex = require("./wrap-index");

module.exports = async function getDataFromRoom(
  room,
  sockets,
  type,
  phasesElapsed = 0
) {
  await Promise.all(
    room.players.map(
      (player, idx) =>
        new Promise((resolve, reject) => {
          // Send this player's data to another player's replayData
          const targetIndex = wrapIndex(
            idx - phasesElapsed,
            room.players.length
          );
          const playerToSendDataTo = room.players[targetIndex];

          sockets[player.id].emit("get-data", (data) => {
            playerToSendDataTo.replayData.rounds.push({
              type,
              data,
              playerName: player.name || player.id,
            });
            resolve(true);
          });
        })
    )
  );
};
