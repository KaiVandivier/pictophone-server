const getDataFromRoom = require("../lib/get-data-from-room");

const fakePlayers = [
  {
    id: "abc1234",
    name: "Player 1",
    ready: false,
    replayData: {
      word: "Word 1",
      rounds: [],
    },
  },
  {
    id: "def1234",
    name: "Player 2",
    ready: false,
    replayData: {
      word: "Word 2",
      rounds: [],
    },
  },
  {
    id: "ghi1234",
    name: "Player 3",
    ready: false,
    replayData: {
      word: "Word 3",
      rounds: [],
    },
  },
  {
    id: "jkl1234",
    name: "Player 4",
    ready: false,
    replayData: {
      word: "Word 4",
      rounds: [],
    },
  },
];

const fakeRoom = {
  id: "rmabc1234",
  players: [...fakePlayers],
};

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
  await getDataFromRoom(fakeRoom, fakeSockets, "drawing");
  const newReplayData = fakeRoom.players.map(
    (player) => player.replayData.rounds
  );
  expect(newReplayData).toEqual([
    [{ type: "drawing", data: "data" }],
    [{ type: "drawing", data: "data" }],
    [{ type: "drawing", data: "data" }],
    [{ type: "drawing", data: "data" }],
  ]);
});
