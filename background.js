// Changes:
// - Adjusted to be compatible with service workers and Manifest V3 limitations
const targetUrl = 'https://www.usvisascheduling.com/en-US/appointment-confirmation/';
const targetDomain = 'usvisascheduling.com';
const CHECK_DELAY = 1500; // 1.5 seconds

let extensionActive = false;
let checkTimeout = null;
let monitoredTabId = null;
let isFirstLoad = true;

function log(message) {
  console.log(message);
}

function openTabWithoutClearingData() {
  log("Opening new tab without clearing data...");
  chrome.tabs.create({ url: targetUrl, active: false }, (tab) => {
    monitoredTabId = tab.id;
    watchAndCheckTab(tab.id);
  });
}

function clearDataAndOpenTab() {
  extensionActive = true;
  isFirstLoad = true;
  log("Extension activated.");

  if (isFirstLoad) {
    openTabWithoutClearingData();
  } else {
    clearDataAndOpenTabAfterFirstLoad();
  }
}

function clearDataAndOpenTabAfterFirstLoad() {
  log("Clearing data for " + targetDomain);
  clearData(() => {
    log("Data cleared. Opening new tab in background...");
    chrome.tabs.create({ url: targetUrl, active: false }, (tab) => {
      monitoredTabId = tab.id;
      watchAndCheckTab(tab.id);
    });
  });
}

function clearData(callback) {
  chrome.browsingData.remove({
    "origins": [`https://${targetDomain}`]
  }, {
    "appcache": true,
    "cache": true,
    "cacheStorage": true,
    "cookies": true,
    "fileSystems": true,
    "indexedDB": true,
    "localStorage": true,
    "serviceWorkers": true,
    "webSQL": true
  }, callback);
}

function watchAndCheckTab(tabId) {
  if (!extensionActive) return;

  if (checkTimeout) {
    clearTimeout(checkTimeout);
    checkTimeout = null;
  }

  checkTimeout = setTimeout(() => checkTabStatus(tabId), CHECK_DELAY);

  chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo) {
    if (updatedTabId === tabId && changeInfo.status === 'complete') {
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(checkTimeout);
      checkTimeout = null;
      checkTabStatus(tabId);
    }
  });
}

function checkTabStatus(tabId) {
  if (!extensionActive) return;

  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) {
      log(`Error accessing tab: ${chrome.runtime.lastError.message}`);
      return;
    }

    if (tab.title.includes("Appointment")) {
      log("Appointment page detected. Switching to the tab and stopping further checks.");
      chrome.tabs.update(tabId, { active: true });
      extensionActive = false;
      cleanup();
    } else {
      log(`Checking tab status. Current title: "${tab.title}", Status: ${tab.status}`);
      if (tab.status === 'loading' || tab.title === 'Home') {
        if (isFirstLoad) {
          log("First load did not succeed. Will clear data and retry.");
          isFirstLoad = false;
          clearDataAndOpenNewTab(tabId);
        } else {
          log("Page is still loading or title is 'Home'. Clearing data and opening new tab...");
          clearDataAndOpenNewTab(tabId);
        }
      } else {
        log("Page loaded successfully with a different title.");
      }
    }
  });
}

function clearDataAndOpenNewTab(oldTabId) {
  if (!extensionActive) return;

  log("Clearing data for " + targetDomain);
  clearData(() => {
    log("Data cleared. Closing current tab and opening a new one in background...");
    chrome.tabs.remove(oldTabId, () => {
      chrome.tabs.create({ url: targetUrl, active: false }, (newTab) => {
        monitoredTabId = newTab.id;
        log("New tab opened in background. Setting up new check...");
        watchAndCheckTab(newTab.id);
      });
    });
  });
}

function cleanup() {
  if (checkTimeout) {
    clearTimeout(checkTimeout);
    checkTimeout = null;
  }
  monitoredTabId = null;
  log("Cleanup complete. Extension is ready for next activation.");
}

chrome.action.onClicked.addListener(clearDataAndOpenTab);
