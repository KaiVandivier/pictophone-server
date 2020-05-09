const DRAWING_TIME = 60;
const GUESSING_TIME = 20;
const COUNTDOWN_TIME = 5;

const phases = Object.freeze({
  WAITING: "waiting",
  CHOOSING_WORD: "choosing-word",
  DRAWING: "drawing",
  GUESSING: "guessing",
  REPLAY: "replay",
});

module.exports = {
  DRAWING_TIME,
  GUESSING_TIME,
  COUNTDOWN_TIME,
  phases
}