const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const { startTimer } = require("./lib/timer");
const { hardWords } = require("./lib/words");
const runGame = require("./lib/game");

const port = process.env.PORT || 4000;
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

io.on("connection", (socket) => {
  console.log(`New client id ${socket.id} connected`);

  socket.once("ready", () => {
    runGame(socket);
  });

  socket.on("disconnect", (socket) => {
    console.log(`Client id ${socket.id} disconnected`);
  });
});

app.get("/", (req, res) => {
  res.status(200).send("Get received");
});

server.listen(port, () => console.log(`Listening on port ${port}`));
