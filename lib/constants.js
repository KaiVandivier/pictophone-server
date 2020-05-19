const DRAWING_TIME = 60;
const GUESSING_TIME = 20;
const COUNTDOWN_TIME = 5;

const phases = Object.freeze({
  WAITING: "WAITING",
  WORD_CHOOSING: "WORD_CHOOSING",
  DRAWING: "DRAWING",
  GUESSING: "GUESSING",
  REPLAY: "REPLAY",
});

const countdownMsgs = Object.freeze({
  DRAWING: "Get ready to draw!",
  GUESSING: "Time to guess!",
});

const events = Object.freeze({
  DRAWING: "load-drawing-phase",
  GUESSING: "load-guessing-phase",
});

const phaseTimes = Object.freeze({
  DRAWING: process.env.NODE_ENV === "production" ? 60 : 10,
  GUESSING: 20,
});

const dataTypes = Object.freeze({
  WORD: "word",
  DRAWING: "drawing",
  GUESSING: "guess",
})

module.exports = {
  DRAWING_TIME,
  GUESSING_TIME,
  COUNTDOWN_TIME,
  phases,
  countdownMsgs,
  events,
  phaseTimes,
  dataTypes,
}