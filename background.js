const targetUrl = 'https://www.usvisascheduling.com/en-US/appointment-confirmation/';
const targetDomain = 'usvisascheduling.com';
const CHECK_DELAY = 1500; // 3 seconds

let extensionActive = false; // Flag to control the extension's activity
let checkTimeout = null; // Variable to store the timeout ID
let tabUpdateListener = null; // Variable to store the tab update listener
let monitoredTabId = null; // Variable to store the ID of the tab being monitored
let isFirstLoad = true; // Flag to indicate if it's the first load

function log(message) {
  console.log(message);
  // Optionally, you can remove the following code to prevent sending messages to the active tab
  /*
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {action: "log", message: message});
    }
  });
  */
}

function openTabWithoutClearingData() {
  log("Opening new tab without clearing data...");
  chrome.tabs.create({ url: targetUrl, active: false }, (tab) => {
    monitoredTabId = tab.id;
    watchAndCheckTab(tab.id);
  });
}

function clearDataAndOpenTab() {
  // Reset the extension state
  extensionActive = true;
  isFirstLoad = true; // Reset first load flag
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
  if (!extensionActive) return; // Stop if the extension is inactive

  // Clear any existing timeout or listener
  if (checkTimeout) {
    clearTimeout(checkTimeout);
    checkTimeout = null;
  }
  if (tabUpdateListener) {
    chrome.tabs.onUpdated.removeListener(tabUpdateListener);
    tabUpdateListener = null;
  }

  checkTimeout = setTimeout(() => checkTabStatus(tabId), CHECK_DELAY);

  tabUpdateListener = function listener(updatedTabId, changeInfo) {
    if (updatedTabId === tabId && changeInfo.status === 'complete') {
      chrome.tabs.onUpdated.removeListener(listener);
      tabUpdateListener = null;
      clearTimeout(checkTimeout);
      checkTimeout = null;
      checkTabStatus(tabId);
    }
  };

  chrome.tabs.onUpdated.addListener(tabUpdateListener);
}

function checkTabStatus(tabId) {
  if (!extensionActive) return; // Stop if the extension is inactive

  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) {
      log(`Error accessing tab: ${chrome.runtime.lastError.message}`);
      return;
    }

    // Check if the title contains the word "Appointment"
    if (tab.title.includes("Appointment")) {
      log("Appointment page detected. Switching to the tab and stopping further checks.");
      
      // Switch to the tab
      chrome.tabs.update(tabId, { active: true }, () => {
        log("Switched to the tab.");
      });
      
      extensionActive = false; // Deactivate the extension
      cleanup(); // Clean up listeners and timeouts
      return; // Exit the function
    }

    log(`Checking tab status. Current title: "${tab.title}", Status: ${tab.status}`);

    if (tab.status === 'loading' || tab.title === 'Home') {
      if (isFirstLoad) {
        log("First load did not succeed. Will clear data and retry.");
        isFirstLoad = false; // Set first load flag to false
        clearDataAndOpenNewTab(tabId);
      } else {
        log("Page is still loading or title is 'Home'. Clearing data and opening new tab...");
        clearDataAndOpenNewTab(tabId);
      }
    } else {
      log("Page loaded successfully with a different title.");
    }
  });
}



function clearDataAndOpenNewTab(oldTabId) {
  if (!extensionActive) return; // Stop if the extension is inactive

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
  // Remove any pending timeouts or listeners
  if (checkTimeout) {
    clearTimeout(checkTimeout);
    checkTimeout = null;
  }
  if (tabUpdateListener) {
    chrome.tabs.onUpdated.removeListener(tabUpdateListener);
    tabUpdateListener = null;
  }
  monitoredTabId = null;
  log("Cleanup complete. Extension is ready for next activation.");
}

chrome.browserAction.onClicked.addListener(clearDataAndOpenTab);
