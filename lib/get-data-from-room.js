module.exports = async function getDataFromRoom(room, sockets, type) {
  await Promise.all(room.players.map(player => (
    new Promise((resolve, reject) => {
      sockets[player.id].emit("get-data", (data) => {
        player.replayData.rounds.push({ type, data });
        resolve(true);
      })
    })
  )))
};
