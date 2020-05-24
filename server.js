const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const runGame = require("./lib/game");
const msgs = require("./lib/messages");

const port = process.env.PORT || 4000;
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

function Room(id, hostId, playerName) {
  this.id = id;
  this.name = `${playerName}'s room`;
  this.hostId = hostId;
  this.players = [];
  this.open = true;
  this.isAllReady = function () {
    return this.players.every((player) => player.ready);
  };
  this.clearReadies = function () {
    this.players = this.players.map((player) => ({ ...player, ready: false }));
  };
  this.clearReplayData = function () {
    this.players = this.players.map((player) => ({
      ...player,
      replayData: [],
    }));
  };
}

function Player(socket, playerName) {
  this.id = socket.id;
  this.name = playerName;
  this.ready = false;
  this.replayData = [];
  this.toggleReady = function () {
    this.ready = !this.ready;
  };
}

let rooms = [];

function joinRoom(socket, roomId, playerName) {
  // Join socket to room; return `new Room`
  if (Object.keys(socket.rooms).includes(roomId))
    return socket.send("You're already in that room!");

  const room = rooms.find((room) => room.id === roomId);
  if (!room) return socket.send("Oops! Can't find that room.");
  if (!room.open) return socket.send("Oops! That room is closed.");

  socket.join(room.id);
  room.players = [...room.players, new Player(socket, playerName)];
  io.to(roomId).emit(msgs.ROOM_UPDATE, room);
  return room;
}

function leaveRoom(socket, roomId) {
  // get room by ID
  const room = rooms.find(({ id }) => id === roomId);
  if (!room) return socket.send("Oops! Can't leave that room.");

  // Disconnect socket from room
  socket.leave(room.id);
  // Remove player from room
  room.players = room.players.filter(({ id }) => id !== socket.id);
  // Remove the room if it's empty
  if (room.players.length === 0) {
    rooms = rooms.filter(({ id }) => id !== room.id);
    return null;
  }
  // Hand off `host` to another player if necessary
  if (room.hostId === socket.id) {
    room.hostId = room.players[0].id;
    room.name = `${room.players[0].name}'s Room`;
  }
  io.to(room.id).emit(msgs.ROOM_UPDATE, room);
  return null;
}

/**
 * Handle players on socket.io connection
 */
io.on("connection", (socket) => {
  console.log(`New client id ${socket.id} connected`);
  let currentRoom;

  socket.on(msgs.CREATE_ROOM, (playerName) => {
    const roomId = `rm${socket.id}`;
    if (rooms.some(({ id }) => id === roomId))
      return socket.send("You have already created that room");
    // create and join room
    rooms.push(new Room(roomId, socket.id, playerName));
    io.emit(
      msgs.OPEN_ROOMS,
      rooms.filter(({ open }) => open).map(({ id, name }) => ({ id, name }))
    );
    currentRoom = joinRoom(socket, roomId, playerName);
  });

  socket.on(msgs.JOIN_ROOM, (roomId, playerName) => {
    currentRoom = joinRoom(socket, roomId, playerName);
  });

  socket.on(msgs.LEAVE_ROOM, () => {
    if (!currentRoom) return socket.send("Not in a room!");
    currentRoom = leaveRoom(socket, currentRoom.id); // i.e. `null`
    socket.emit(msgs.ROOM_UPDATE, null);
  });

  socket.on(msgs.GET_ROOMS, (ack) => {
    // Return `open` rooms
    ack(rooms.filter(({ open }) => open).map(({ id, name }) => ({ id, name })));
  });

  socket.on(msgs.TOGGLE_READY, () => {
    if (!currentRoom) return socket.send("Oops! There's no room.");
    currentRoom.players.find(({ id }) => id === socket.id).toggleReady();
    io.to(currentRoom.id).emit(msgs.ROOM_UPDATE, currentRoom);
    // Here is a possible place to check for "all ready" and listen for "start-game"
    // instead of having "start game" be open all the time
  });

  socket.on(msgs.START_GAME, () => {
    if (!currentRoom) return socket.send("Oops! There's no room.");
    if (!currentRoom.isAllReady()) return socket.send("Not everyone is ready!");
    runGame(socket, io, currentRoom);
  });

  socket.on("disconnect", (reason) => {
    // TODO: Handle reconnect (ex: "would you like to reconnect as player ____?")
    if (currentRoom) leaveRoom(socket, currentRoom.id);
    console.log(`Client id ${socket.id} disconnected - reason: ${reason}`);
  });
});

app.get("/", (req, res) => {
  res.status(200).send("GET received");
});

server.listen(port, () => console.log(`Listening on port ${port}`));
