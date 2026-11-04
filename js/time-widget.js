(() => {
  "use strict";

  const clock = document.getElementById("Lviv_z713");
  if (!clock) return;

  const container = document.getElementById("time-widget-content");
  const toggle = document.getElementById("time-widget-toggle");

  if (container && toggle) {
    toggle.addEventListener("click", () => {
      container.hidden = !container.hidden;
      toggle.setAttribute("aria-expanded", String(!container.hidden));
      toggle.textContent = container.hidden
        ? "Показати годинник"
        : "Приховати годинник";
    });
  }

  const unavailable = () => {
    clock.textContent = "Час тимчасово недоступний";
  };

  if (
    !window.time_is_widget ||
    typeof window.time_is_widget.init !== "function"
  ) {
    unavailable();
    return;
  }

  // Detect output from Time.is; never substitute a locally generated clock.
  let observer;
  const timeout = window.setTimeout(() => {
    observer.disconnect();
    unavailable();
  }, 10000);

  observer = new MutationObserver(() => {
    if (/\d{1,2}:\d{2}/.test(clock.textContent)) {
      window.clearTimeout(timeout);
      observer.disconnect();
    }
  });
  observer.observe(clock, { childList: true, subtree: true, characterData: true });

  try {
    window.time_is_widget.init({ Lviv_z713: {} });
    if (/\d{1,2}:\d{2}/.test(clock.textContent)) {
      window.clearTimeout(timeout);
      observer.disconnect();
    }
  } catch {
    window.clearTimeout(timeout);
    observer.disconnect();
    unavailable();
  }
})();