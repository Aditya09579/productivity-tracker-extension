// dashboard.js - reads storage and renders a simple bar chart + pie + table

function formatMinutes(seconds) {
  return Math.round(seconds / 60);
}

function drawBarChart(ctx, labels, values) {
  ctx.clearRect(0,0,ctx.canvas.width, ctx.canvas.height);
  const padding = 40;
  const w = ctx.canvas.width - padding*2;
  const h = ctx.canvas.height - padding*2;
  const maxVal = Math.max(...values, 1);
  const barWidth = Math.max(12, Math.floor(w / Math.max(1, labels.length)) - 8);

  // axes
  ctx.strokeStyle = "#333";
  ctx.beginPath();
  ctx.moveTo(padding, padding + h);
  ctx.lineTo(padding + w, padding + h);
  ctx.stroke();

  // bars
  values.forEach((v, i) => {
    const x = padding + i*(barWidth+8);
    const barH = Math.round((v / maxVal) * h);
    const y = padding + (h - barH);
    ctx.fillStyle = "#4a90e2";
    ctx.fillRect(x, y, barWidth, barH);
    ctx.fillStyle = "#000";
    ctx.font = "11px Arial";
    ctx.fillText(labels[i], x, padding + h + 14);
    ctx.fillText(String(v), x, y - 6);
  });
}

function drawPieChart(ctx, values, colors) {
  ctx.clearRect(0,0,ctx.canvas.width, ctx.canvas.height);
  const total = values.reduce((a,b)=>a+b,0) || 1;
  let start = -Math.PI/2;
  const cx = ctx.canvas.width/2;
  const cy = ctx.canvas.height/2;
  const r = Math.min(cx, cy) - 10;

  values.forEach((v,i) => {
    const slice = (v/total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, start + slice);
    ctx.closePath();
    ctx.fillStyle = colors[i];
    ctx.fill();
    start += slice;
  });

  // legend
  ctx.font = "12px Arial";
  let y = 10;
  values.forEach((v,i) => {
    ctx.fillStyle = colors[i];
    ctx.fillRect(8, y+8, 12, 12);
    ctx.fillStyle = "#000";
    ctx.fillText(`${Math.round((v/total)*100)}%`, 28, y+18);
    y += 20;
  });
}

function renderTable(wrap, rows) {
  let html = `<table><thead><tr><th>Domain</th><th>Seconds</th><th>Minutes</th><th>Status</th></tr></thead><tbody>`;
  rows.forEach(r => {
    html += `<tr><td>${r.domain}</td><td>${r.seconds}</td><td>${Math.round(r.seconds/60)}</td><td>${r.status}</td></tr>`;
  });
  html += `</tbody></table>`;
  wrap.innerHTML = html;
}

function loadAndRender() {
  chrome.storage.local.get(['totals', 'siteStatus'], (data) => {
    const totals = data.totals || {};
    const siteStatus = data.siteStatus || {};
    const entries = Object.entries(totals).sort((a,b) => b[1]-a[1]);

    // prepare labels & values for bar
    const labels = entries.map(e => e[0]);
    const values = entries.map(e => Math.round(e[1] / 60)); // minutes for chart scale

    // prepare pie values: productive vs unproductive vs unknown (seconds)
    let productiveSec = 0, unproductiveSec = 0, unknownSec = 0;
    entries.forEach(([d, sec]) => {
      const s = siteStatus[d] || "unknown";
      if (s === "productive") productiveSec += sec;
      else if (s === "unproductive") unproductiveSec += sec;
      else unknownSec += sec;
    });

    // draw bar chart (minutes per domain)
    const bar = document.getElementById('barChart');
    const bctx = bar.getContext('2d');
    drawBarChart(bctx, labels, values);

    // draw pie chart
    const pie = document.getElementById('pieChart');
    const pctx = pie.getContext('2d');
    drawPieChart(pctx, [productiveSec, unproductiveSec, unknownSec], ['#2ecc71', '#e74c3c', '#95a5a6']);

    // table rows
    const rows = entries.map(([d, s]) => ({ domain: d, seconds: s, status: siteStatus[d] || "unknown" }));
    renderTable(document.getElementById('tableWrap'), rows);
  });
}

document.getElementById('refreshBtn').onclick = loadAndRender;
document.getElementById('exportBtn').onclick = () => {
  chrome.storage.local.get(['totals', 'siteStatus'], (data) => {
    const totals = data.totals || {};
    const siteStatus = data.siteStatus || {};
    const rows = [["domain","seconds","minutes","status"]];
    for (const [d, s] of Object.entries(totals)) {
      rows.push([d, s, Math.round(s/60), siteStatus[d] || "unknown"]);
    }
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "productivity_dashboard.csv";
    a.click();
    URL.revokeObjectURL(url);
  });
};
document.getElementById('printBtn').onclick = () => window.print();

loadAndRender();
