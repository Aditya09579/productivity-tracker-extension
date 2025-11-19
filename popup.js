// popup.js - buttons to classify + export CSV with status + open dashboard

function formatMinutes(seconds) {
  return Math.round(seconds / 60);
}

chrome.storage.local.get(['totals', 'siteStatus'], (data) => {
  const totals = data.totals || {};
  const siteStatus = data.siteStatus || {}; // store classification

  const entries = Object.entries(totals).sort((a,b) => b[1]-a[1]);
  const container = document.getElementById("data");

  if (entries.length === 0) {
    container.innerHTML = "No activity yet.";
    return;
  }

  let productiveSec = 0;
  let unproductiveSec = 0;

  // Summary calc
  entries.forEach(([domain, sec]) => {
    if (siteStatus[domain] === "productive") productiveSec += sec;
    else if (siteStatus[domain] === "unproductive") unproductiveSec += sec;
  });

  const totalSec = entries.reduce((s,e) => s + e[1], 0);

  // Build UI
  let html = `
    <h4>Summary</h4>
    <div>Total: ${formatMinutes(totalSec)} min</div>
    <div>Productive: ${formatMinutes(productiveSec)} min</div>
    <div>Unproductive: ${formatMinutes(unproductiveSec)} min</div>
    <hr>
    <h4>Websites</h4>
  `;

  entries.forEach(([domain, sec]) => {
    const status = siteStatus[domain] || "unknown";
    html += `
      <div style="margin-bottom:12px">
        <strong>${domain}</strong> — ${formatMinutes(sec)} min
        <div style="margin-top:6px;">
          <button data-domain="${domain}" data-type="productive" class="btn-small">Productive</button>
          <button data-domain="${domain}" data-type="unproductive" class="btn-small">Unproductive</button>
          <button data-domain="${domain}" data-type="clear" class="btn-small">Clear</button>
        </div>
        <div style="color:#666; margin-top:4px;">Current: ${status}</div>
      </div>
    `;
  });

  // Action buttons (Export, Reset, Open Dashboard)
  html += `
    <div style="margin-top:8px; display:flex; gap:8px;">
      <button id="exportBtn">Export CSV</button>
      <button id="resetBtn">Reset</button>
      <button id="openDashBtn">Open Dashboard</button>
    </div>
  `;

  container.innerHTML = html;

  // Classification buttons
  document.querySelectorAll("button[data-domain]").forEach(btn => {
    btn.onclick = () => {
      const domain = btn.dataset.domain;
      const type = btn.dataset.type;
      if (type === "clear") {
        delete siteStatus[domain];
      } else {
        siteStatus[domain] = type;
      }
      chrome.storage.local.set({ siteStatus }, () => {
        window.location.reload();
      });
    };
  });

  // Export CSV (with status)
  document.getElementById("exportBtn").onclick = () => {
    const rows = [["domain","seconds","minutes","status"]];
    for (const [d, s] of Object.entries(totals)) {
      const st = siteStatus[d] || "unknown";
      rows.push([d, s, Math.round(s/60), st]);
    }
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "productivity_totals.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Reset
  document.getElementById("resetBtn").onclick = () => {
    if (!confirm("Reset all tracked data?")) return;
    chrome.storage.local.set({ totals: {}, active: { domain: null, lastStarted: null }, siteStatus: {} }, () => {
      window.location.reload();
    });
  };

  // Open Dashboard (opens dashboard.html inside extension)
  document.getElementById("openDashBtn").onclick = () => {
    const dashUrl = chrome.runtime.getURL('dashboard.html');
    chrome.tabs.create({ url: dashUrl });
  };
});
