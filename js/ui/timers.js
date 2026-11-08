// Kitchen timers: times in a recipe ("20 min") become buttons that start a
// timer; running timers show as chips in a strip above the bottom bar, on
// every page. Tap a chip's time to pause or go on, its name to open the
// recipe, × to stop it. When time is up it chimes and vibrates until Done.
import * as timers from "../timerState.js";
import { findDurations, timerLabel, formatClock } from "../lib/timers.js";
import { keepScreenOn } from "./screenAwake.js";
import { showToast } from "./toast.js";

const strip = document.getElementById("timer-strip");

let ticking = null;
let ringing = null;
let audio = null;

// --- Times in the recipe text become buttons ---

// Wraps every cooking time in the element's text in a button. Headings and
// existing buttons or links are left alone.
export function linkTimes(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.parentElement.closest("button, a, h1, h2, h3, h4") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }
  for (const node of nodes) {
    const text = node.textContent;
    const found = findDurations(text);
    if (!found.length) {
      continue;
    }
    // The step's words, for the timer's name ("Roast")
    const step = node.parentElement.closest("li, p") || node.parentElement;
    const stepText = step.textContent;
    const offset = stepText.indexOf(text);
    const pieces = [];
    let at = 0;
    for (const time of found) {
      pieces.push(document.createTextNode(text.slice(at, time.start)));
      const button = document.createElement("button");
      button.type = "button";
      button.className = "time-link";
      button.textContent = text.slice(time.start, time.end);
      button.dataset.seconds = String(time.seconds);
      button.dataset.label = timerLabel(stepText, Math.max(0, offset) + time.start);
      button.title = "Start a " + formatClock(time.seconds) + " timer";
      pieces.push(button);
      at = time.end;
    }
    pieces.push(document.createTextNode(text.slice(at)));
    node.replaceWith(...pieces);
  }
}

// A tap on a time in the recipe: start its timer (once).
export function startFromButton(button, recipeId) {
  const seconds = Number(button.dataset.seconds);
  const label = button.dataset.label;
  prepareSound(); // the tap lets the app make sound later
  if (timers.findSame(recipeId, label, seconds)) {
    showToast(label + " is already running");
    return;
  }
  timers.start(label, recipeId, seconds);
  showToast("Timer started: " + label + ", " + formatClock(seconds));
}

// --- The strip of chips ---

function chip(timer) {
  const item = document.createElement("div");
  item.className = "timer-chip " + timer.state;
  item.dataset.id = timer.id;

  const name = document.createElement("a");
  name.className = "timer-name";
  name.href = "#/r/" + encodeURIComponent(timer.recipeId);
  name.textContent = timer.label;
  name.title = "Open the recipe";

  const time = document.createElement("button");
  time.type = "button";
  time.className = "timer-time";
  time.dataset.action = timer.state === "ringing" ? "done" : "pause";

  item.append(name, time);
  if (timer.state !== "ringing") {
    const stop = document.createElement("button");
    stop.type = "button";
    stop.className = "timer-stop";
    stop.dataset.action = "stop";
    stop.title = "Stop this timer";
    stop.setAttribute("aria-label", "Stop " + timer.label);
    stop.innerHTML = '<svg class="line-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    item.append(stop);
  }
  showTime(item, timer);
  return item;
}

function showTime(item, timer) {
  const time = item.querySelector(".timer-time");
  if (timer.state === "ringing") {
    time.textContent = "Done";
    time.title = "Stop the alarm (X)";
  } else {
    time.textContent = formatClock(timers.secondsLeft(timer));
    time.title = timer.state === "paused" ? "Paused: tap to go on" : "Tap to pause";
  }
}

export function renderTimers() {
  const list = timers.getTimers();
  strip.hidden = list.length === 0;
  strip.replaceChildren(...list.map(chip));
  const running = list.some((timer) => timer.state === "running");
  const anyRinging = list.some((timer) => timer.state === "ringing");
  keepScreenOn("timers", running || anyRinging);
  // Count down while something runs
  if (running && !ticking) {
    ticking = setInterval(tick, 250);
  } else if (!running && ticking) {
    clearInterval(ticking);
    ticking = null;
  }
  if (anyRinging) {
    startAlarm();
  } else {
    stopAlarm();
  }
}

// Only the clocks change each tick; the chips stay, so taps don't miss.
function tick() {
  if (timers.checkFinished()) {
    return; // that redrew everything
  }
  for (const timer of timers.getTimers()) {
    const item = strip.querySelector('[data-id="' + timer.id + '"]');
    if (item) {
      showTime(item, timer);
    }
  }
}

// --- The alarm: a soft two-note chime and vibration, every 2.5 s ---

function prepareSound() {
  try {
    audio = audio || new AudioContext();
    if (audio.state === "suspended") {
      audio.resume();
    }
  } catch {
    audio = null; // no sound here; vibration still works
  }
}

function chime() {
  if (audio) {
    const now = audio.currentTime;
    for (const [frequency, delay] of [[660, 0], [880, 0.28]]) {
      const tone = audio.createOscillator();
      const volume = audio.createGain();
      tone.type = "sine";
      tone.frequency.value = frequency;
      volume.gain.setValueAtTime(0.0001, now + delay);
      volume.gain.exponentialRampToValueAtTime(0.35, now + delay + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.9);
      tone.connect(volume).connect(audio.destination);
      tone.start(now + delay);
      tone.stop(now + delay + 1);
    }
  }
  if (navigator.vibrate) {
    navigator.vibrate([300, 150, 300]);
  }
}

function startAlarm() {
  if (ringing) {
    return;
  }
  chime();
  ringing = setInterval(chime, 2500);
}

function stopAlarm() {
  if (ringing) {
    clearInterval(ringing);
    ringing = null;
    if (navigator.vibrate) {
      navigator.vibrate(0);
    }
  }
}

// X: stop every ringing alarm.
export function dismissAlarms() {
  timers.dismissRinging();
}

export function initTimers() {
  strip.addEventListener("click", function (event) {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }
    const id = button.closest(".timer-chip").dataset.id;
    if (button.dataset.action === "pause") {
      timers.togglePause(id);
    } else if (button.dataset.action === "stop") {
      timers.remove(id);
    } else {
      timers.remove(id); // Done
    }
  });
  timers.onChange(renderTimers);
  // Back from another app: catch up at once (the clock kept going).
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      timers.checkFinished();
      tick();
    }
  });
  timers.checkFinished();
  renderTimers();
}
