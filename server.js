const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const { startTimer } = require("./lib/timer");

const port = process.env.PORT || 4000;
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

io.on("connection", (socket) => {
  console.log("New client connected, id: ", socket.id);

  socket.emit("message", { message: "You connected successfully!" })

  socket.on("start-timer", () => {
    console.log("received start-timer event");
    startTimer(socket, 90);
  })

  socket.on("disconnect", (socket) => {
    console.log("Client disconnected")
  })
});

app.get("/", (req, res) => {
  res.status(200).send("Get received");
})

server.listen(port, () => console.log(`Listening on port ${port}`));
