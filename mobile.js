(() => {
  const actionMap = {
    up: () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" })),
    down: () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" })),
    left: () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" })),
    right: () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" })),
    interact: () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" })),
    rest: () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" })),
    memory: () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "m" })),
    newrun: () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "n" }))
  };

  let lastTap = 0;

  function runTouchAction(button) {
    const action = button.dataset.touchAction;
    const handler = actionMap[action];
    if (!handler) return;

    const now = Date.now();
    if (now - lastTap < 80) return;
    lastTap = now;

    button.classList.add("is-pressed");
    window.setTimeout(() => button.classList.remove("is-pressed"), 120);
    handler();
  }

  function bindTouchControls() {
    document.querySelectorAll("[data-touch-action]").forEach((button) => {
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        runTouchAction(button);
      });

      button.addEventListener("click", (event) => {
        event.preventDefault();
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindTouchControls);
  } else {
    bindTouchControls();
  }
})();
