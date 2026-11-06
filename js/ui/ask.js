// "Are you sure?" in the app's own style, instead of the browser's box
// (which shows the site address as its title). Resolves to true or false.
const dialog = document.getElementById("ask-dialog");
const text = document.getElementById("ask-text");
const okButton = document.getElementById("ask-ok");

let answer = null;

// yes: the button's words, e.g. "Delete". danger: shown as a warning.
export function ask(question, yes, danger) {
  // A question still open is answered "no" first.
  if (answer) {
    answer(false);
  }
  text.textContent = question;
  okButton.textContent = yes || "OK";
  okButton.classList.toggle("danger", Boolean(danger));
  okButton.classList.toggle("primary", !danger);
  okButton.classList.toggle("button", Boolean(danger));
  dialog.returnValue = "";
  dialog.showModal();
  return new Promise(function (resolve) {
    answer = resolve;
  });
}

export function initAsk() {
  dialog.addEventListener("close", function () {
    const done = answer;
    answer = null;
    if (done) {
      done(dialog.returnValue === "ok");
    }
  });
}
