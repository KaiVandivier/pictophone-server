const getDataFromRoom = require("../lib/get-data-from-room");
const { fakePlayers } = require("../utils/testing");

// Mock message/acknowledgement pattern
// TODO: this might want to handle more args in the future
const emit = jest.fn((msg, ack) => setTimeout(() => ack("data"), 0));

const fakeSockets = {
  abc1234: { emit },
  def1234: { emit },
  ghi1234: { emit },
  jkl1234: { emit },
};

test("it updates replayData in room", async () => {
  const fakeRoom = {
    id: "rmabc1234",
    players: [...fakePlayers()],
  };

  await getDataFromRoom(fakeRoom, fakeSockets, "drawing", 0);

  const newReplayData = fakeRoom.players.map(
    (player) => player.replayData
  );
  // console.log(newReplayData);
  expect(newReplayData).toEqual([
    [ { type: 'drawing', data: 'data', playerName: 'Player 1' } ],
    [ { type: 'drawing', data: 'data', playerName: 'Player 2' } ],
    [ { type: 'drawing', data: 'data', playerName: 'Player 3' } ],
    [ { type: 'drawing', data: 'data', playerName: 'Player 4' } ]
  ]);
});

test("it sends data to right players", async () => {
  const fakeRoom = {
    id: "rmabc1234",
    players: [...fakePlayers()],
  };

  await getDataFromRoom(fakeRoom, fakeSockets, "drawing", 2);

  const newReplayData = fakeRoom.players.map(
    (player) => player.replayData
  );
  // console.log(newReplayData);
  expect(newReplayData).toEqual([
      [ { type: 'drawing', data: 'data', playerName: 'Player 3' } ],
      [ { type: 'drawing', data: 'data', playerName: 'Player 4' } ],
      [ { type: 'drawing', data: 'data', playerName: 'Player 1' } ],
      [ { type: 'drawing', data: 'data', playerName: 'Player 2' } ]
    ]);
});
