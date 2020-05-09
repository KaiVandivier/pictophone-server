const DRAW_TIME = 60;
const GUESS_TIME = 20;
const COUNTDOWN_TIME = 5;

const phases = Object.freeze({
  WAITING: "waiting",
  CHOOSING_WORD: "choosing-word",
  DRAWING: "drawing",
  GUESSING: "guessing",
  REPLAY: "replay",
});

module.exports = {
  DRAW_TIME,
  GUESS_TIME,
  COUNTDOWN_TIME,
  phases
}