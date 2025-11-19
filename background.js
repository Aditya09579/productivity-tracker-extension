// background.js - MV3 service worker for basic domain time tracking

const TICK_INTERVAL_MINUTES = 0.5; // 30 seconds
let active = { domain: null, lastStarted: null };

// helper: extract domain from a URL
function getDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch (e) {
    return null;
  }
}

// load state from storage on startup
async function loadState() {
  return new Promise((res) => {
    chrome.storage.local.get(["totals", "active"], (data) => {
      const totals = data.totals || {};
      const storedActive = data.active || null;
      chrome.storage.local.set({ totals }); // normalize
      if (storedActive && storedActive.domain && storedActive.lastStarted) {
        active = storedActive;
      } else {
        active = { domain: null, lastStarted: null };
      }
      res({ totals, active });
    });
  });
}

function saveActive() {
  chrome.storage.local.set({ active });
}

function addSecondsToDomain(domain, seconds) {
  if (!domain || seconds <= 0) return;
  chrome.storage.local.get("totals", (data) => {
    const totals = data.totals || {};
    totals[domain] = (totals[domain] || 0) + Math.round(seconds);
    chrome.storage.local.set({ totals }, () => {
      console.log(`[Tracker] added ${Math.round(seconds)}s to ${domain}. Total now: ${totals[domain]}s`);
    });
  });
}

function persistElapsed() {
  if (!active.domain || !active.lastStarted) return;
  const now = Date.now();
  const elapsedMs = now - active.lastStarted;
  if (elapsedMs <= 0) {
    active.lastStarted = now;
    saveActive();
    return;
  }
  const seconds = elapsedMs / 1000;
  addSecondsToDomain(active.domain, seconds);
  active.lastStarted = now;
  saveActive();
}

function setActiveDomain(domain) {
  if (domain === active.domain) return;
  persistElapsed();
  if (domain) {
    active.domain = domain;
    active.lastStarted = Date.now();
  } else {
    active.domain = null;
    active.lastStarted = null;
  }
  saveActive();
  console.log("[Tracker] active domain set to:", active.domain);
}

function updateActiveFromChrome() {
  try {
    chrome.windows.getLastFocused({ populate: true }, (window) => {
      if (!window || window.state === "minimized") {
        setActiveDomain(null);
        return;
      }
      const tab = window.tabs && window.tabs.find(t => t.active);
      if (!tab || !tab.url) {
        setActiveDomain(null);
        return;
      }
      const domain = getDomain(tab.url);
      setActiveDomain(domain);
    });
  } catch (e) {
    console.error("[Tracker] updateActiveFromChrome error:", e);
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm && alarm.name === "tick") {
    persistElapsed();
  }
});

loadState().then(() => {
  chrome.alarms.create("tick", { periodInMinutes: TICK_INTERVAL_MINUTES });
  updateActiveFromChrome();
});

chrome.tabs.onActivated.addListener(() => { updateActiveFromChrome(); });
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => { if (changeInfo.url && tab.active) updateActiveFromChrome(); });
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) setActiveDomain(null);
  else updateActiveFromChrome();
});

self.addEventListener("unload", () => { persistElapsed(); });
