const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const runGame = require("./lib/game");
const msgs = require("./lib/messages");

const port = process.env.PORT || 4000;
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  handlePreflightRequest: (req, res) => {
      const headers = {
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Origin": req.headers.origin, //or the specific origin you want to give access to,
          "Access-Control-Allow-Credentials": true
      };
      res.writeHead(200, headers);
      res.end();
  }
});

// const phases = Object.freeze({
//   WAITING: "waiting",
//   CHOOSING_WORD: "choosing-word",
//   DRAWING: "drawing",
//   GUESSING: "guessing",
//   REPLAY: "replay",
// });

function Room(id, creatorId, playerName) {
  this.id = id;
  this.name = `${playerName}'s room`;
  this.creatorId = creatorId;
  this.players = [];
  // this.phase = phases.WAITING;
  this.isAllReady = function () {
    return this.players.every((player) => player.ready);
  };
  this.clearReadies = function () {
    this.players.forEach((player) => (player.ready = false));
    // "replacement" instead of "mutation":
    // this.players = this.players.map(player => ({ ...player, ready = false }))
  };
}

function Player(socket, playerName) {
  this.id = socket.id;
  this.name = playerName;
  this.ready = false;
  this.replayData = { word: null, rounds: [] };
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
  if (!room) {
    socket.send("Room not found");
    return;
  }
  room.players = [...room.players, new Player(socket, playerName)];
  socket.join(room.id);
  io.to(roomId).emit(msgs.ROOM_UPDATE, room);
  return room;
}

io.on("connection", (socket) => {
  console.log(`New client id ${socket.id} connected`);
  let currentRoom;

  socket.on(msgs.CREATE_ROOM, (playerName) => {
    const roomId = `rm${socket.id}`;
    if (rooms.some(({ id }) => id === roomId))
      return socket.send("You have already created that room");
    // create and join room
    rooms.push(new Room(roomId, socket.id, playerName));
    socket.send(`Room ${roomId} created`);
    currentRoom = joinRoom(socket, roomId, playerName);
  });

  socket.on(msgs.JOIN_ROOM, (roomId, playerName) => {
    currentRoom = joinRoom(socket, roomId, playerName);
  });

  socket.on(msgs.GET_ROOMS, () => {
    socket.emit(
      msgs.ALL_ROOMS,
      rooms.map(({ id }) => id)
    );
  });

  // TODO: This should only happen once a player is inside a room ~
  // TODO: Turn this off somewhere?
  socket.on(msgs.TOGGLE_READY, () => {
    currentRoom.players.find(({ id }) => id === socket.id).toggleReady();
    io.to(currentRoom.id).emit(msgs.ROOM_UPDATE, currentRoom);
    // Here is a possible place to check for "all ready" and listen for "start-game"
  });

  socket.once(msgs.START_GAME, () => {
    // const allReady = currentRoom.players.every(({ ready }) => ready);
    if (!currentRoom.isAllReady()) return socket.send("Not everyone is ready!");
    runGame(socket, io, currentRoom);
  });

  socket.on("disconnect", () => {
    // TODO: Handle reconnect (ex: "would you like to reconnect as player ____?")
    if (currentRoom) {
      console.log(currentRoom);
      currentRoom.players = currentRoom.players.filter(
        ({ id }) => id !== socket.id
      );
      io.to(currentRoom.id).emit(msgs.ROOM_UPDATE, currentRoom);
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
