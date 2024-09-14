let overlay;

function createOverlay() {
  overlay = document.createElement('div');
  overlay.id = 'extension-overlay';
  document.body.appendChild(overlay);
}

function updateOverlay(message) {
  if (!overlay) createOverlay();
  const logEntry = document.createElement('p');
  logEntry.textContent = new Date().toLocaleTimeString() + ": " + message;
  overlay.appendChild(logEntry);
  overlay.scrollTop = overlay.scrollHeight;
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "log") {
    updateOverlay(request.message);
  }
});

