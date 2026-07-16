const { useMemo, useRef, useEffect, useState, useCallback } = React;
const SAMPLE_CSV_FILENAME = "MDS_20220401_20230531_20230705_171405.csv";

function getClimateFromDate(value) {
  if (!value) return "Unknown";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Unknown";
  const m = d.getMonth() + 1;
  if ([3, 4, 5, 6].includes(m)) return "Summer";
  if ([7, 8, 9].includes(m)) return "Monsoon";
  return "Winter";
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function cleanRows(rows) {
  return rows.map((r) => ({
    Bench: (r.Bench || "").trim(),
    Date: (r.Date || "").trim(),
    Duration: toNumber(r.Duration),
    BWE: (r.BWE || "").trim(),
    GroupCodeText: (r["Group code text"] || "").trim(),
    GroupCode: String(r["Group code"] || "").trim(),
    Remarks: (r.Remarks || "").trim(),
    Shift: (r.Shift || "").trim(),
    Plant: (r.Plant || "").trim(),
    MaterialNumber: String(r["Material Number"] || "").trim(),
    TimeFrom: (r["Time From"] || "").trim(),
    TimeTo: (r["Time to"] || "").trim(),
    Climate: getClimateFromDate(r.Date)
  }));
}

function groupCount(rows, key) {
  const m = new Map();
  rows.forEach((r) => {
    const k = r[key] || "Unknown";
    m.set(k, (m.get(k) || 0) + 1);
  });
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function groupSum(rows, key, sumKey) {
  const m = new Map();
  rows.forEach((r) => {
    const k = r[key] || "Unknown";
    m.set(k, (m.get(k) || 0) + toNumber(r[sumKey]));
  });
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function computeTopIssuesPerMachine(rows) {
  const machineCounts = groupCount(rows, "BWE").slice(0, 8).map(([m]) => m);
  const filtered = rows.filter((r) => machineCounts.includes(r.BWE));
  const m = new Map();
  filtered.forEach((r) => {
    const key = [r.BWE, r.GroupCodeText, r.Remarks].join("||");
    if (!m.has(key)) {
      m.set(key, { BWE: r.BWE, GroupCodeText: r.GroupCodeText, Remarks: r.Remarks, Count: 0 });
    }
    m.get(key).Count += 1;
  });

  const byMachine = new Map();
  [...m.values()]
    .sort((a, b) => b.Count - a.Count)
    .forEach((x) => {
      const arr = byMachine.get(x.BWE) || [];
      if (arr.length < 5) arr.push(x);
      byMachine.set(x.BWE, arr);
    });

  return [...byMachine.values()].flat();
}

function computeAvgDowntime(rows) {
  const m = new Map();
  rows.forEach((r) => {
    const k = r.BWE || "Unknown";
    if (!m.has(k)) m.set(k, { BWE: k, Duration: 0, FailureCount: 0, AvgDowntime: 0 });
    const obj = m.get(k);
    obj.Duration += toNumber(r.Duration);
    obj.FailureCount += 1;
    obj.AvgDowntime = obj.FailureCount ? obj.Duration / obj.FailureCount : 0;
  });
  return [...m.values()].sort((a, b) => b.Duration - a.Duration);
}

function computeMapping(rows) {
  const map = {};
  rows.forEach((r) => {
    const gc = String(r.GroupCode || "").trim();
    const txt = String(r.GroupCodeText || "").trim().toLowerCase();
    if (!gc || !txt) return;
    const words = txt.replace(/\./g, " ").split(/\s+/).filter(Boolean);
    if (gc.length !== words.length) return;

    for (let i = 0; i < gc.length; i++) {
      const pos = String(i + 1);
      const digit = gc[i];
      const word = words[i][0] ? words[i][0].toUpperCase() + words[i].slice(1) : words[i];
      if (!map[pos]) map[pos] = {};
      if (!map[pos][digit]) map[pos][digit] = new Set();
      map[pos][digit].add(word);
    }
  });

  const out = {};
  Object.keys(map).forEach((pos) => {
    out[pos] = {};
    Object.keys(map[pos]).forEach((digit) => {
      out[pos][digit] = [...map[pos][digit]].sort();
    });
  });
  return out;
}

function downloadCsv(filename, headers, rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.join(",")];
  rows.forEach((r) => {
    lines.push(headers.map((h) => esc(r[h])).join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function PlotCard({ id, data, layout }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !window.Plotly) return;
    try {
      // Use react for better updates and be tolerant of empty/invalid data
      const layoutSafe = { margin: { t: 35, l: 45, r: 20, b: 60 }, ...(layout || {}) };
      window.Plotly.react(ref.current, data || [], layoutSafe, { responsive: true, displaylogo: false });
    } catch (e) {
      // render a simple fallback message inside the container
      ref.current.innerHTML = '<div style="padding:16px;color:#666">Unable to render chart</div>';
      // keep silent in console but preserve debug info
      console.debug('Plotly render error', e);
    }
  }, [data, layout]);
  return (
    <div className="plot-wrapper">
      <div id={id} ref={ref} style={{ width: "100%", height: "360px", maxWidth: "640px" }} />
    </div>
  );
}

function computeTopMachinesByClimate(rows, topN = 5) {
  const climates = [...new Set(rows.map((r) => r.Climate || 'Unknown'))];
  const out = {};
  climates.forEach((c) => {
    const filtered = rows.filter((r) => (r.Climate || 'Unknown') === c && (r.BWE || '').trim());
    const counts = groupCount(filtered, 'BWE').slice(0, topN);
    out[c] = counts; // array of [machine, count]
  });
  return out;
}

const FilterDropdown = React.memo(function FilterDropdown({ col, uniqueVals, colFilters, onFilterChange }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(new Set(colFilters[col] || []));
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return Array.from(uniqueVals);
    const q = searchQuery.trim().toLowerCase();
    return Array.from(uniqueVals).filter((val) => String(val).toLowerCase().includes(q));
  }, [uniqueVals, searchQuery]);

  function toggleVal(val) {
    const newSel = new Set(selected);
    if (newSel.has(val)) newSel.delete(val);
    else newSel.add(val);
    setSelected(newSel);
    onFilterChange(col, Array.from(newSel));
  }

  function clearFilter() {
    setSelected(new Set());
    setSearchQuery("");
    onFilterChange(col, []);
  }

  return (
    <div style={{position:'relative', display:'inline-block', zIndex:1000}}>
      <button className="btn btn-sm btn-outline-secondary" onClick={() => setOpen(!open)} title={`Filter ${col}`} style={{padding:'4px 8px', fontSize:'0.85rem'}}>
        <i className="fa-solid fa-filter me-1"></i>{selected.size > 0 ? `(${selected.size})` : ''}
      </button>
      {open && (
        <div style={{position:'absolute', top:'100%', left:0, backgroundColor:'#fff', border:'1px solid #dee2e6', borderRadius:'4px', padding:'10px', zIndex:10000, minWidth:'280px', maxHeight:'450px', overflowY:'auto', boxShadow:'0 4px 12px rgba(0,0,0,0.15)'}}>
          <input 
            type="text" 
            placeholder="Search values..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            style={{width:'100%', padding:'6px 8px', marginBottom:'10px', fontSize:'0.85rem', border:'1px solid #dee2e6', borderRadius:'4px', boxSizing:'border-box'}} 
          />
          <div style={{borderBottom:'1px solid #dee2e6', marginBottom:'10px', paddingBottom:'10px', maxHeight:'250px', overflowY:'auto'}}>
            {filtered.length > 0 ? (
              filtered.map((val) => (
                <div key={val} style={{marginBottom:'6px'}}>
                  <label style={{display:'flex', alignItems:'center', cursor:'pointer', margin:0, fontSize:'0.9rem'}}>
                    <input type="checkbox" checked={selected.has(val)} onChange={() => toggleVal(val)} style={{marginRight:'8px'}} />
                    {val}
                  </label>
                </div>
              ))
            ) : (
              <div style={{fontSize:'0.9rem', color:'#999', padding:'8px'}}>No results</div>
            )}
          </div>
          {selected.size > 0 && (
            <button className="btn btn-xs btn-outline-danger" onClick={clearFilter} style={{width:'100%', padding:'4px'}}>
              <i className="fa-solid fa-times me-1"></i>Clear Filter
            </button>
          )}
        </div>
      )}
    </div>
  );
});

const DATA_VIEW_COLS = ['S.No', 'Bench', 'BWE', 'Date', 'Shift', 'Time From', 'Time To', 'Duration', 'Remarks', 'Plant', 'Material Number', 'GroupCode', 'GroupCodeText'];
const COL_MAP = { 'Bench': 'Bench', 'BWE': 'BWE', 'Date': 'Date', 'Shift': 'Shift', 'Time From': 'TimeFrom', 'Time To': 'TimeTo', 'Duration': 'Duration', 'Remarks': 'Remarks', 'Plant': 'Plant', 'Material Number': 'MaterialNumber', 'GroupCode': 'GroupCode', 'GroupCodeText': 'GroupCodeText' };

function DataView({ rows }) {
  const displayCols = DATA_VIEW_COLS;
  const mapCol = COL_MAP;

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [colFilters, setColFilters] = useState({});
  const [colSortDir, setColSortDir] = useState({});

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleFilterChange = useCallback((col, vals) => {
    setColFilters((prev) => ({...prev, [col]: vals}));
    setPage(1);
  }, []);

  const handlePageSizeChange = useCallback((newSize) => {
    setPageSize(newSize);
    setPage(1);
  }, []);

  const handleQueryChange = useCallback((val) => {
    setQuery(val);
    setPage(1);
  }, []);

  const uniqueVals = useMemo(() => {
    const uv = {};
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      for (const dc of displayCols) {
        if (dc === 'S.No') continue;
        const v = String(r[mapCol[dc]] ?? '').trim();
        if (v) {
          if (!uv[dc]) uv[dc] = new Set();
          uv[dc].add(v);
        }
      }
    }
    return uv;
  }, [rows, displayCols, mapCol]);

  const filtered = useMemo(() => {
    let out = rows;
    const q = debouncedQuery.trim().toLowerCase();

    // Apply search filter
    if (q) {
      out = out.filter((r) => {
        for (const dc of displayCols) {
          if (dc === 'S.No') continue;
          const val = String(r[mapCol[dc]] ?? "").toLowerCase();
          if (val.includes(q)) return true;
        }
        return false;
      });
    }

    // Apply column filters
    const hasFilters = Object.keys(colFilters).some((dc) => colFilters[dc]?.length > 0);
    if (hasFilters) {
      out = out.filter((r) => {
        for (const dc of displayCols) {
          if (dc === 'S.No' || !colFilters[dc] || colFilters[dc].length === 0) continue;
          const val = String(r[mapCol[dc]] ?? '');
          if (!colFilters[dc].includes(val)) return false;
        }
        return true;
      });
    }

    // Apply sorting for any column that has a sort direction
    for (const dc of displayCols) {
      if (dc === 'S.No' || !colSortDir[dc]) continue;
      const mapKey = mapCol[dc];
      const sortDir = colSortDir[dc];
      out = out.slice().sort((a, b) => {
        const A = String(a[mapKey] ?? "");
        const B = String(b[mapKey] ?? "");
        const cmp = A.localeCompare(B, undefined, { numeric: true });
        return cmp * sortDir;
      });
      break; // Only sort by one column at a time
    }

    return out;
  }, [rows, debouncedQuery, colFilters, displayCols, mapCol, colSortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { if (page > totalPages) setPage(1); }, [totalPages]);
  const pageData = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div>
      <div className="mb-3 p-3" style={{backgroundColor:'#f8f9fa', borderRadius:'4px', borderLeft:'3px solid #0d6efd'}}>
        <div className="row align-items-end mb-2">
          <div className="col-md-8">
            <label className="form-label mb-1 fw-bold">Global Search</label>
            <input className="form-control" placeholder="Search across all columns..." value={query} onChange={(e) => handleQueryChange(e.target.value)} />
          </div>
          <div className="col-md-4">
            <label className="form-label mb-1 fw-bold">Rows per page</label>
            <select className="form-select" value={pageSize} onChange={(e) => handlePageSizeChange(Number(e.target.value))}>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mb-2 d-flex justify-content-between align-items-center">
        <div style={{fontSize:'0.9rem', color:'#666'}}>
          <strong>{filtered.length}</strong> row{filtered.length!==1?'s':''} match{filtered.length!==1?'':'es'} | Page <strong>{page}</strong> of <strong>{totalPages}</strong>
        </div>
        <button className="btn btn-sm btn-outline-primary" onClick={() => {
          const headers = displayCols.filter(c => c !== 'S.No').map(dc => mapCol[dc]);
          downloadCsv('full_data.csv', headers, filtered.map((r, i) => {
            const out = {};
            displayCols.filter(c => c !== 'S.No').forEach((dc) => {
              const mapKey = mapCol[dc];
              out[dc] = r[mapKey];
            });
            return out;
          }));
        }}>
          <i className="fa-solid fa-download me-1"></i>Download CSV
        </button>
      </div>

      <div style={{border:'1px solid #dee2e6', borderRadius:'4px', overflow:'hidden'}}>
        <div style={{maxHeight: '600px', overflow: 'auto', position:'relative'}}>
          <table className="table table-sm mb-0" style={{backgroundColor:'#fff', borderSpacing:0}}>
            <thead style={{position:'sticky', top:0, zIndex:10, backgroundColor:'#f8f9fa', borderBottom:'2px solid #dee2e6'}}>
              <tr>
                <th style={{width:'40px', textAlign:'center', backgroundColor:'#e9ecef', fontWeight:'bold', color:'#495057', padding:'8px 4px', borderRight:'1px solid #dee2e6'}}>S.No</th>
                {displayCols.filter(c => c !== 'S.No').map((dc) => (
                  <th key={dc} style={{whiteSpace:'nowrap', fontWeight:'bold', padding:'8px 10px', backgroundColor:'#f8f9fa', borderRight:'1px solid #dee2e6', userSelect:'none'}}>
                    <div style={{display:'flex', alignItems:'center', gap:'4px', justifyContent:'space-between'}}>
                      <span>{dc}</span>
                      <div style={{display:'flex', gap:'4px', alignItems:'center'}}>
                        <FilterDropdown col={dc} uniqueVals={uniqueVals[dc] || new Set()} colFilters={colFilters} onFilterChange={handleFilterChange} />
                        <button className="btn btn-xs btn-outline-secondary" onClick={() => { setColSortDir(colSortDir[dc] === 1 ? {} : {[dc]: 1}); }} style={{padding:'2px 6px', fontSize:'0.7rem', backgroundColor: colSortDir[dc] === 1 ? '#e7f1ff' : 'transparent'}} title="Sort A-Z">
                          <i className="fa-solid fa-arrow-up-a-z"></i>
                        </button>
                        <button className="btn btn-xs btn-outline-secondary" onClick={() => { setColSortDir(colSortDir[dc] === -1 ? {} : {[dc]: -1}); }} style={{padding:'2px 6px', fontSize:'0.7rem', backgroundColor: colSortDir[dc] === -1 ? '#e7f1ff' : 'transparent'}} title="Sort Z-A">
                          <i className="fa-solid fa-arrow-down-z-a"></i>
                        </button>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageData.map((r, i) => (
                <tr key={i} style={{borderBottom:'1px solid #dee2e6', backgroundColor: i%2===0 ? '#fff' : '#f9fafb'}}>
                  <td style={{textAlign:'center', backgroundColor: i%2===0 ? '#f8f9fa' : '#f0f1f2', fontWeight:'500', color:'#666', fontSize:'0.85rem', padding:'8px 4px', borderRight:'1px solid #dee2e6'}}>{(page-1)*pageSize+i+1}</td>
                  {displayCols.filter(c => c !== 'S.No').map((dc) => {
                    const mapKey = mapCol[dc];
                    return <td key={dc} style={{padding:'8px 10px', whiteSpace:'nowrap', fontSize:'0.9rem', borderRight:'1px solid #dee2e6', maxWidth:'200px', overflow:'hidden', textOverflow:'ellipsis'}} title={String(r[mapKey] ?? '')}>
                      {String(r[mapKey] ?? '')}
                    </td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-3 d-flex justify-content-between align-items-center">
        <div>
          <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => setPage(1)} disabled={page===1}><i className="fa-solid fa-angles-left me-1"></i>First</button>
          <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => setPage((p) => Math.max(1, p-1))} disabled={page===1}><i className="fa-solid fa-angle-left me-1"></i>Prev</button>
          <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => setPage((p) => Math.min(totalPages, p+1))} disabled={page===totalPages}>Next <i className="fa-solid fa-angle-right ms-1"></i></button>
          <button className="btn btn-sm btn-outline-secondary" onClick={() => setPage(totalPages)} disabled={page===totalPages}>Last <i className="fa-solid fa-angles-right ms-1"></i></button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState("upload");
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  const parsed = useMemo(() => cleanRows(rows), [rows]);

  const metrics = useMemo(() => {
    const totalDowntime = parsed.reduce((s, r) => s + toNumber(r.Duration), 0);
    const totalIssues = parsed.length;
    const topMachine = groupCount(parsed, "BWE")[0]?.[0] || "-";
    return { totalDowntime, totalIssues, topMachine };
  }, [parsed]);

  const topMachines = useMemo(() => groupCount(parsed, "BWE").slice(0, 8), [parsed]);
  const climateDowntime = useMemo(() => groupSum(parsed, "Climate", "Duration"), [parsed]);
  const topByClimate = useMemo(() => computeTopMachinesByClimate(parsed, 5), [parsed]);
  const shiftDist = useMemo(() => groupCount(parsed, "Shift"), [parsed]);
  const topGroupCodes = useMemo(() => groupSum(parsed, "GroupCodeText", "Duration").slice(0, 10), [parsed]);
  const plantDist = useMemo(() => groupCount(parsed, "Plant").slice(0, 8), [parsed]);
  const materialDist = useMemo(() => groupCount(parsed, "MaterialNumber").slice(0, 8), [parsed]);
  const topIssues = useMemo(() => computeTopIssuesPerMachine(parsed), [parsed]);
  const avgDowntime = useMemo(() => computeAvgDowntime(parsed), [parsed]);
  const mapping = useMemo(() => computeMapping(parsed), [parsed]);

  function handleUpload(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError("");
    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        if (!res.data || !res.data.length) {
          setError("CSV is empty or invalid.");
          return;
        }
        setRows(res.data);
        setFileName(f.name);
        setActiveTab("analysis");
      },
      error: () => setError("Failed to parse CSV.")
    });
  }

  async function loadSample() {
    setError("");
    try {
      const res = await fetch(SAMPLE_CSV_FILENAME);
      if (!res.ok) {
        setError("Could not fetch sample CSV from app folder.");
        return;
      }
      const txt = await res.text();
      const parsedRes = Papa.parse(txt, { header: true, skipEmptyLines: true });
      if (!parsedRes.data || !parsedRes.data.length) {
        setError("Sample CSV is empty or invalid.");
        return;
      }
      setRows(parsedRes.data);
      setFileName(SAMPLE_CSV_FILENAME);
      setActiveTab("analysis");
    } catch (e) {
      console.debug('loadSample error', e);
      setError("Failed to load sample CSV.");
    }
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="sidebar-header">NLC</div>
        <nav className="sidebar-nav">
          <button className={activeTab === "upload" ? "active" : ""} onClick={() => setActiveTab("upload")}>
            <i className="fa-solid fa-upload me-2"></i>Upload
          </button>
          <button className={activeTab === "data" ? "active" : ""} onClick={() => setActiveTab("data")}>
            <i className="fa-solid fa-table-list me-2"></i>Data
          </button>
          <button className={activeTab === "analysis" ? "active" : ""} onClick={() => setActiveTab("analysis")}>
            <i className="fa-solid fa-chart-bar me-2"></i>Analysis
          </button>
          <button className={activeTab === "mapping" ? "active" : ""} onClick={() => setActiveTab("mapping")}>
            <i className="fa-solid fa-list-alt me-2"></i>Group Code Mapping
          </button>
        </nav>
      </aside>

      <div className="app-main">
        <header className="topbar">Downtime Analysis</header>
        <main className="main-content container-fluid">
          {activeTab === "upload" && (
            <div className="chart-card upload-box">
              <h5>Upload Downtime CSV</h5>
              {error ? <div className="error">{error}</div> : null}
              <input className="form-control" type="file" accept=".csv" onChange={handleUpload} />
              <div className="mt-3 muted">{fileName ? `Loaded: ${fileName}` : "Upload a CSV to start analysis."}</div>
            </div>
          )}

          {activeTab === "data" && (
            parsed.length ? (
              <div className="chart-card">
                <h5>Full Data</h5>
                <DataView rows={parsed} />
              </div>
            ) : <div className="chart-card muted">Upload a CSV first to view data.</div>
          )}

          {activeTab === "analysis" && (
            parsed.length ? (
              <>
                <div className="grid-3">
                  <div className="chart-card kpi"><div className="value">{metrics.totalDowntime.toFixed(1)}</div><div className="label">Total Downtime</div></div>
                  <div className="chart-card kpi"><div className="value">{metrics.totalIssues}</div><div className="label">Total Issues</div></div>
                  <div className="chart-card kpi"><div className="value">{metrics.topMachine}</div><div className="label">Top Machine</div></div>
                </div>

                <div className="grid-2 mt-3">
                  <div className="chart-card">
                    <h6>Top Machines</h6>
                    <PlotCard id="top-machines" data={[{ x: topMachines.map((x) => String(x[0])), y: topMachines.map((x) => x[1]), type: "bar" }]} layout={{ xaxis: { type: 'category', tickangle: -45 }, bargap: 0.2, height: 360 }} />
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => downloadCsv("top_issues.csv", ["BWE", "GroupCodeText", "Remarks", "Count"], topIssues)}>Download Top Issues CSV</button>
                  </div>
                  <div className="chart-card">
                    <h6>Climate Downtime</h6>
                    <PlotCard id="climate" data={[{ x: climateDowntime.map((x) => String(x[0])), y: climateDowntime.map((x) => x[1]), type: "bar" }]} layout={{ xaxis: { type: 'category' }, bargap: 0.2, height: 360 }} />
                  </div>
                </div>

                <div className="chart-card mt-2">
                  <h6>Top 5 Machines by Climate</h6>
                  <div className="row">
                    {Object.keys(topByClimate).map((c) => (
                      <div className="col-md-4" key={c}>
                        <div className="chart-card">
                          <h6 style={{marginBottom:8}}>{c}</h6>
                          <PlotCard id={`climate-top-${c.replace(/\s+/g, "-")}`} data={[{ x: topByClimate[c].map((x) => String(x[0])), y: topByClimate[c].map((x) => x[1]), type: "bar" }]} layout={{ xaxis: { type: 'category' }, bargap: 0.15, height: 200 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid-2">
                  <div className="chart-card">
                    <h6>Shift Distribution</h6>
                    <PlotCard id="shift" data={[{ labels: shiftDist.map((x) => x[0]), values: shiftDist.map((x) => x[1]), type: "pie" }]} />
                  </div>
                  <div className="chart-card">
                    <h6>Top 10 Group Codes</h6>
                    <PlotCard id="group-codes" data={[{ x: topGroupCodes.map((x) => String(x[0])), y: topGroupCodes.map((x) => x[1]), type: "bar" }]} layout={{ xaxis: { type: 'category', tickangle: -45 }, bargap: 0.2, height: 360 }} />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="chart-card">
                    <h6>Plant Distribution</h6>
                    <PlotCard id="plant" data={[{ labels: plantDist.map((x) => x[0]), values: plantDist.map((x) => x[1]), type: "pie" }]} />
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => downloadCsv("plant.csv", ["Plant", "Count"], plantDist.map(([Plant, Count]) => ({ Plant, Count })))}>Download Plant CSV</button>
                  </div>
                  <div className="chart-card">
                    <h6>Material Distribution</h6>
                    <PlotCard id="material" data={[{ labels: materialDist.map((x) => x[0]), values: materialDist.map((x) => x[1]), type: "pie" }]} />
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => downloadCsv("material.csv", ["Material", "Count"], materialDist.map(([Material, Count]) => ({ Material, Count })))}>Download Material CSV</button>
                  </div>
                </div>

                <div className="chart-card">
                  <h6>Top Issues per Machine</h6>
                  <div className="table-wrap">
                    <table className="table table-sm table-striped">
                      <thead><tr><th>Machine</th><th>Group Code</th><th>Remarks</th><th>Count</th></tr></thead>
                      <tbody>
                        {topIssues.map((r, i) => (
                          <tr key={i}><td>{r.BWE}</td><td>{r.GroupCodeText}</td><td>{r.Remarks}</td><td>{r.Count}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="chart-card">
                  <h6>Average Downtime by Machine</h6>
                  <button className="btn btn-sm btn-outline-secondary mb-2" onClick={() => downloadCsv("avg_downtime.csv", ["BWE", "Duration", "FailureCount", "AvgDowntime"], avgDowntime)}>Download Avg Downtime CSV</button>
                  <div className="table-wrap">
                    <table className="table table-sm table-striped">
                      <thead><tr><th>Machine</th><th>Total Duration</th><th>Failure Count</th><th>Avg Downtime</th></tr></thead>
                      <tbody>
                        {avgDowntime.slice(0, 25).map((r, i) => (
                          <tr key={i}><td>{r.BWE}</td><td>{r.Duration.toFixed(1)}</td><td>{r.FailureCount}</td><td>{r.AvgDowntime.toFixed(1)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : <div className="chart-card muted">Upload a CSV first to see analysis.</div>
          )}

          {activeTab === "mapping" && (
            parsed.length ? (
              <div className="chart-card">
                <h4>Group Code to Group Code Text Mapping</h4>
                {Object.keys(mapping).length ? (
                  <>
                    <div className="row mt-3">
                      {Object.keys(mapping).sort((a, b) => Number(a) - Number(b)).map((pos) => (
                        <div className="col-md-6" key={pos}>
                          <div className="chart-card">
                            <h6>Position {pos}</h6>
                            <table className="table table-sm table-bordered">
                              <thead><tr><th>Digit</th><th>Words</th></tr></thead>
                              <tbody>
                                {Object.keys(mapping[pos]).sort().map((digit) => (
                                  <tr key={digit}><td>{digit}</td><td>{mapping[pos][digit].join(", ")}</td></tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => {
                        const rowsOut = [];
                        Object.keys(mapping).forEach((pos) => {
                          Object.keys(mapping[pos]).forEach((digit) => {
                            rowsOut.push({ Position: pos, Digit: digit, Words: mapping[pos][digit].join(", ") });
                          });
                        });
                        downloadCsv("mapping.csv", ["Position", "Digit", "Words"], rowsOut);
                      }}
                    >
                      Download Mapping CSV
                    </button>
                  </>
                ) : <div className="muted mt-2">No mapping could be computed from this uploaded file.</div>}
              </div>
            ) : <div className="chart-card muted">Upload a CSV first to see group code mapping.</div>
          )}
        </main>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
