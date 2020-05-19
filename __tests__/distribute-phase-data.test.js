const distributePhaseData = require("../lib/distribute-phase-data");
const { fakePlayers } = require("../utils/testing");

let fakeRoom, emit, fakeSockets;
beforeEach(() => {
  fakeRoom = {
    id: "rmabc1234",
    players: [...fakePlayers()],
  };
  // Mock message/acknowledgement pattern
  // TODO: this might want to handle more args in the future
  emit = jest.fn((msg, data, ack) => setTimeout(() => ack(true), 0));
  fakeSockets = {
    abc1234: { emit },
    def1234: { emit },
    ghi1234: { emit },
    jkl1234: { emit },
  };
});

test("it sends data to players", async () => {
  await distributePhaseData(fakeRoom, fakeSockets, "load-drawing-phase", 0);

  // console.log(emit.mock.calls);
  expect(emit.mock.calls.length).toBe(fakeRoom.players.length);
  expect(emit.mock.calls[0][0]).toBe("load-drawing-phase");
  expect(emit.mock.calls[0][1]).toBe("Word 1");
  expect(typeof emit.mock.calls[0][2]).toBe("function");
});

test("it sends data to right players (i.e., handles phase shift)", async () => {
  const phasesElapsed = 6;
  await distributePhaseData(
    fakeRoom,
    fakeSockets,
    "load-drawing-phase",
    phasesElapsed
  );

  // console.log(emit.mock.calls);
  expect(emit.mock.calls[0][1]).toBe("Word 3");
});
