for (const button of document.querySelectorAll('[data-embed-load]')) {
  const frame = document.getElementById(button.getAttribute('aria-controls'));
  if (!frame?.dataset.embedSrc) continue;
  button.hidden = false;
  button.addEventListener('click', () => {
    frame.src = frame.dataset.embedSrc;
    frame.hidden = false;
    frame.focus();
    button.hidden = true;
  });
}
