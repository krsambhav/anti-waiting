const targetUrl = 'https://www.usvisascheduling.com/en-US/appointment-confirmation/';
const targetDomain = 'usvisascheduling.com';
const CHECK_DELAY = 4000; // 4 seconds

function log(message) {
  console.log(message);
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {action: "log", message: message});
  });
}

function clearDataAndOpenTab() {
  log("Clearing data for " + targetDomain);
  clearData(() => {
    log("Data cleared. Opening new tab...");
    chrome.tabs.create({ url: targetUrl }, (tab) => {
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
  let checkTimeout = setTimeout(() => checkTabStatus(tabId), CHECK_DELAY);

  chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo) {
    if (updatedTabId === tabId && changeInfo.status === 'complete') {
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(checkTimeout);
      checkTabStatus(tabId);
    }
  });
}

function checkTabStatus(tabId) {
  chrome.tabs.get(tabId, (tab) => {
    log(`Checking tab status. Current title: "${tab.title}", Status: ${tab.status}`);
    if (tab.status === 'loading' || tab.title === 'Home') {
      log("Page is still loading or title is 'Home'. Clearing data and opening new tab...");
      clearDataAndOpenNewTab(tabId);
    } else {
      log("Page loaded successfully with a different title.");
    }
  });
}

function clearDataAndOpenNewTab(oldTabId) {
  log("Clearing data for " + targetDomain);
  clearData(() => {
    log("Data cleared. Closing current tab and opening a new one...");
    chrome.tabs.remove(oldTabId, () => {
      chrome.tabs.create({ url: targetUrl }, (newTab) => {
        log("New tab opened. Setting up new check...");
        watchAndCheckTab(newTab.id);
      });
    });
  });
}

chrome.browserAction.onClicked.addListener(clearDataAndOpenTab);