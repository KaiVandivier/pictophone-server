const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const runGame = require("./lib/game");
const msgs = require("./lib/messages");

const port = process.env.PORT || 4000;
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

/**
 * Get players in a room with `io.in(room).clients((err, clients) => {})`;
 * Get rooms a player is in with `socket.rooms`
 *
 */

const phases = Object.freeze({
  WAITING: "waiting",
  CHOOSING_WORD: "choosing-word",
  DRAWING: "drawing",
  GUESSING: "guessing",
  REPLAY: "replay",
});

function Room(id, creatorId) {
  this.id = id;
  this.creatorId = creatorId;
  this.players = [];
  this.phase = phases.WAITING;
  // possible other fields:
  // replayData
  // turnCount
  // (other game tracking)
}

function Player(id) {
  this.id = id;
  this.name = null;
  this.ready = false;
  this.toggleReady = function () {
    this.ready = !this.ready;
  };
  // this.roomId = null;
}

let rooms = [];

function joinRoom(socket, roomId, player) {
  // Join socket to room; return `new Room`
  if (Object.keys(socket.rooms).includes(roomId))
    return socket.send("You're already in that room!");
  const room = rooms.find((room) => room.id === roomId);
  if (!room) {
    socket.send("Room not found");
    return;
  }
  room.players = [...room.players, new Player(socket.id)];
  socket.join(room.id);
  io.to(roomId).emit("room-update", room);
  return room;
}

io.on("connection", (socket) => {
  console.log(`New client id ${socket.id} connected`);
  let currentRoom;

  socket.once("get-data", (ack) => ack(["I'm", "a", "test", "array"]));

  socket.on(msgs.CREATE_ROOM, () => {
    const roomId = `rm${socket.id}`;
    if (rooms.some(({ id }) => id === roomId))
      return socket.send("You have already created that room");
    // create and join room
    rooms.push(new Room(roomId, socket.id));
    socket.send(`Room ${roomId} created`);
    currentRoom = joinRoom(socket, roomId);
  });

  socket.on(msgs.JOIN_ROOM, ({ roomId }) => {
    currentRoom = joinRoom(socket, roomId);
  });

  socket.on(msgs.GET_ROOMS, () => {
    socket.emit(msgs.ALL_ROOMS, { roomIds: rooms.map(({ id }) => id) });
  });

  // TODO: This should only happen once a player is inside a room ~
  // TODO: Turn this off somewhere?
  socket.on(msgs.TOGGLE_READY, () => {
    currentRoom.players.find(({ id }) => id === socket.id).toggleReady();
    io.to(currentRoom.id).emit(msgs.ROOM_UPDATE, currentRoom);
    // Here is a possible place to check for "all ready" and listen for "start-game"
  });

  socket.once("ready", () => {
    // TODO: Modify this to "Start Game" and make a "Toggle ready" feature
    runGame(socket, io, currentRoom);
  });

  socket.on("disconnect", () => {
    // TODO: Handle reconnect (ex: "would you like to reconnect as player ____?")
    if (currentRoom) {
      console.log(currentRoom);
      currentRoom.players = currentRoom.players.filter(
        ({ id }) => id !== socket.id
      );
      io.to(currentRoom.id).emit("room-update", currentRoom);
    }
    // What happens when the socket is the room creator?
    // TODO: Handle handoff to another player
    rooms = rooms.filter(({ creatorId }) => creatorId !== socket.id);
    console.log(`Client id ${socket.id} disconnected`);
  });
});

app.get("/", (req, res) => {
  res.status(200).send("Get received");
});

server.listen(port, () => console.log(`Listening on port ${port}`));
