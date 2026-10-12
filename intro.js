(() => {
  const splash = document.getElementById("intro-splash");
  if (!splash) return;

  // The overlay blocks pointer input; capture keyboard events until it is gone.
  const blockKeyboard = (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  document.addEventListener("keydown", blockKeyboard, true);
  document.addEventListener("keyup", blockKeyboard, true);

  splash.addEventListener("animationend", (event) => {
    if (event.target !== splash || event.animationName !== "intro-splash-exit") return;
    document.removeEventListener("keydown", blockKeyboard, true);
    document.removeEventListener("keyup", blockKeyboard, true);
    splash.remove();
    window.dispatchEvent(new Event("tiltmaze:introcomplete"));
  });
})();
