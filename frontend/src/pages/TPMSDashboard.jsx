import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Chart from 'chart.js/auto';
import ChartZoom from 'chartjs-plugin-zoom';

Chart.register(ChartZoom);

const MAX_HISTORY_POINTS = 50;

function TPMSDashboard() {
  const navigate = useNavigate();
  const mainChartRef = useRef(null);
  const mainChartInstanceRef = useRef(null);
  const detailChartRef = useRef(null);
  const detailChartInstanceRef = useRef(null);
  const simulationRef = useRef(null);

  const [config, setConfig] = useState(null);
  const [tireData, setTireData] = useState({});
  const [view, setView] = useState('top-view');
  const [selectedMetric, setSelectedMetric] = useState('pressure');
  const [selectedTire, setSelectedTire] = useState(null);
  const [detailView, setDetailView] = useState('pressure');
  const [dataHistory, setDataHistory] = useState({ pressure: {}, temperature: {}, battery: {} });
  const [isCollecting, setIsCollecting] = useState(false);

  const getTirePositionName = useCallback((tireNum, axleConfig) => {
    let currentTire = 0;
    for (let axleIndex = 0; axleIndex < axleConfig.length; axleIndex++) {
      const tiresOnAxle = axleConfig[axleIndex];
      for (let i = 0; i < tiresOnAxle; i++) {
        currentTire++;
        if (currentTire === tireNum) {
          const axleName = axleIndex === 0 ? 'Front' : axleIndex === axleConfig.length - 1 ? 'Rear' : `Axle ${axleIndex + 1}`;
          const side = i < tiresOnAxle / 2 ? 'Left' : 'Right';
          const position = tiresOnAxle > 2 ? (i % (tiresOnAxle / 2) === 0 ? ' Outer' : ' Inner') : '';
          return `${axleName} ${side}${position}`;
        }
      }
    }
    return `Tire ${tireNum}`;
  }, []);

  const calculateStatus = useCallback((tire) => {
    if (tire.pressure < 20 || tire.pressure > 120 || tire.temperature > 80 || tire.battery < 2.5) {
      return 'critical';
    } else if (tire.pressure < 30 || tire.pressure > 100 || tire.temperature > 60 || tire.battery < 3) {
      return 'warning';
    }
    return 'normal';
  }, []);

  const generateColors = useCallback((count) => {
    const colors = [];
    const hueStep = 360 / Math.max(count, 1);
    for (let i = 0; i < count; i++) {
      const hue = (i * hueStep) % 360;
      const saturation = 70 + (i % 3) * 10;
      const lightness = 45 + (i % 2) * 10;
      colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
    }
    return colors;
  }, []);

  useEffect(() => {
    const savedConfig = sessionStorage.getItem('tpmsConfig');
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      setConfig(parsed);

      const initialTires = {};
      const initialHistory = { pressure: {}, temperature: {}, battery: {} };

      for (let i = 1; i <= parsed.totalTires; i++) {
        initialTires[i] = {
          id: i,
          position: getTirePositionName(i, parsed.axleConfig),
          pressure: 35 + Math.random() * 10,
          temperature: 20 + Math.random() * 15,
          battery: 3 + Math.random() * 2,
          status: 'normal',
          lastUpdate: new Date(),
        };
        initialHistory.pressure[i] = [];
        initialHistory.temperature[i] = [];
        initialHistory.battery[i] = [];
      }

      setTireData(initialTires);
      setDataHistory(initialHistory);

      const now = new Date();
      for (let point = 0; point < 20; point++) {
        const timeLabel = new Date(now.getTime() - (20 - point) * 2000).toLocaleTimeString();
        for (let i = 1; i <= parsed.totalTires; i++) {
          const basePressure = 35 + (i % 3) * 5;
          const baseTemp = 20 + (i % 2) * 5;
          const baseBattery = 3.5 + (i % 4) * 0.5;
          initialHistory.pressure[i].push({ x: timeLabel, y: basePressure + (Math.random() - 0.5) * 8 });
          initialHistory.temperature[i].push({ x: timeLabel, y: baseTemp + (Math.random() - 0.5) * 10 });
          initialHistory.battery[i].push({ x: timeLabel, y: Math.max(2, Math.min(5, baseBattery + (Math.random() - 0.5) * 1)) });
        }
      }
      setDataHistory({ ...initialHistory });
      setIsCollecting(true);
    }

    return () => {
      if (simulationRef.current) {
        clearInterval(simulationRef.current);
      }
    };
  }, [getTirePositionName]);

  useEffect(() => {
    if (!isCollecting || !config) return;

    const simulate = () => {
      setTireData(prev => {
        const updated = { ...prev };
        const now = new Date();
        const timeLabel = now.toLocaleTimeString();

        for (let i = 1; i <= config.totalTires; i++) {
          const basePressure = 35 + (i % 3) * 5;
          const baseTemp = 20 + (i % 2) * 5;
          const baseBattery = 3.5 + (i % 4) * 0.5;

          const newPressure = basePressure + (Math.random() - 0.5) * 8;
          const newTemp = baseTemp + (Math.random() - 0.5) * 10;
          const newBattery = Math.max(2, Math.min(5, baseBattery + (Math.random() - 0.5) * 1));

          updated[i] = {
            ...updated[i],
            pressure: newPressure,
            temperature: newTemp,
            battery: newBattery,
            lastUpdate: now,
            status: calculateStatus({ pressure: newPressure, temperature: newTemp, battery: newBattery }),
          };
        }

        setDataHistory(prevHistory => {
          const newHistory = { ...prevHistory };
          for (let i = 1; i <= config.totalTires; i++) {
            ['pressure', 'temperature', 'battery'].forEach(metric => {
              if (!newHistory[metric][i]) newHistory[metric][i] = [];
              newHistory[metric][i] = [...newHistory[metric][i], { x: timeLabel, y: updated[i][metric] }];
              if (newHistory[metric][i].length > MAX_HISTORY_POINTS) {
                newHistory[metric][i] = newHistory[metric][i].slice(-MAX_HISTORY_POINTS);
              }
            });
          }
          return newHistory;
        });

        return updated;
      });
    };

    simulationRef.current = setInterval(simulate, 2000);
    return () => {
      if (simulationRef.current) {
        clearInterval(simulationRef.current);
      }
    };
  }, [isCollecting, config, calculateStatus]);

  useEffect(() => {
    if (!mainChartRef.current || !config || Object.keys(dataHistory.pressure).length === 0) return;

    const ctx = mainChartRef.current.getContext('2d');
    if (mainChartInstanceRef.current) {
      mainChartInstanceRef.current.destroy();
    }

    const colors = generateColors(config.totalTires);
    const datasets = [];
    let allLabels = new Set();

    for (let i = 1; i <= config.totalTires; i++) {
      const history = dataHistory[selectedMetric][i] || [];
      history.forEach(h => allLabels.add(h.x));
    }

    const sortedLabels = Array.from(allLabels).sort();

    for (let i = 1; i <= config.totalTires; i++) {
      const history = dataHistory[selectedMetric][i] || [];
      const dataMap = new Map(history.map(h => [h.x, h.y]));
      const data = sortedLabels.map(label => dataMap.get(label) || null);

      datasets.push({
        label: `Tire ${i} (${getTirePositionName(i, config.axleConfig)})`,
        data: data,
        borderColor: colors[i - 1],
        backgroundColor: colors[i - 1] + '40',
        tension: 0.4,
        fill: false,
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2,
      });
    }

    const titles = {
      pressure: 'Pressure (PSI)',
      temperature: 'Temperature (°C)',
      battery: 'Battery Level (W)',
    };

    mainChartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: { labels: sortedLabels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: `TPMS ${titles[selectedMetric]} Over Time`, font: { size: 18, weight: 'bold' }, color: '#f2f5ff' },
          legend: { display: true, position: 'top', labels: { color: '#f2f5ff', font: { size: 12 }, padding: 15, usePointStyle: true } },
          tooltip: { mode: 'index', intersect: false, backgroundColor: 'rgba(0, 0, 0, 0.8)', padding: 12, titleColor: '#f2f5ff', bodyColor: '#f2f5ff' },
          zoom: {
            wheel: { enabled: true, speed: 0.1 },
            pinch: { enabled: true },
            mode: 'x',
          },
        },
        scales: {
          x: { title: { display: true, text: 'Time', font: { size: 14, weight: 'bold' }, color: '#9ba3c7' }, grid: { color: 'rgba(31, 34, 53, 0.3)' }, ticks: { color: '#9ba3c7' } },
          y: { title: { display: true, text: titles[selectedMetric], font: { size: 14, weight: 'bold' }, color: '#9ba3c7' }, grid: { color: 'rgba(31, 34, 53, 0.3)' }, ticks: { color: '#9ba3c7' }, beginAtZero: false },
        },
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
      },
    });

    return () => {
      if (mainChartInstanceRef.current) {
        mainChartInstanceRef.current.destroy();
      }
    };
  }, [dataHistory, selectedMetric, config, generateColors, getTirePositionName]);

  useEffect(() => {
    if (selectedTire === null || !detailChartRef.current || !dataHistory.pressure[selectedTire]) return;

    const ctx = detailChartRef.current.getContext('2d');
    if (detailChartInstanceRef.current) {
      detailChartInstanceRef.current.destroy();
    }

    const pressureHistory = dataHistory.pressure[selectedTire] || [];
    const tempHistory = dataHistory.temperature[selectedTire] || [];
    const batteryHistory = dataHistory.battery[selectedTire] || [];

    const allLabels = new Set();
    pressureHistory.forEach(h => allLabels.add(h.x));
    tempHistory.forEach(h => allLabels.add(h.x));
    batteryHistory.forEach(h => allLabels.add(h.x));

    const sortedLabels = Array.from(allLabels).sort();

    const pressureMap = new Map(pressureHistory.map(h => [h.x, h.y]));
    const tempMap = new Map(tempHistory.map(h => [h.x, h.y]));
    const batteryMap = new Map(batteryHistory.map(h => [h.x, h.y]));

    const pressureData = sortedLabels.map(label => pressureMap.get(label) || null);
    const tempData = sortedLabels.map(label => tempMap.get(label) || null);
    const batteryData = sortedLabels.map(label => batteryMap.get(label) || null);

    const datasets = [
      { label: 'Pressure (PSI)', data: pressureData, borderColor: '#29d98c', backgroundColor: 'rgba(41, 217, 140, 0.1)', tension: 0.4, fill: true, pointRadius: 3, pointHoverRadius: 5, borderWidth: 2, hidden: detailView !== 'pressure' },
      { label: 'Temperature (°C)', data: tempData, borderColor: '#ff9800', backgroundColor: 'rgba(255, 152, 0, 0.1)', tension: 0.4, fill: true, pointRadius: 3, pointHoverRadius: 5, borderWidth: 2, hidden: detailView !== 'temperature' },
      { label: 'Battery (W)', data: batteryData, borderColor: '#5cc8ff', backgroundColor: 'rgba(92, 200, 255, 0.1)', tension: 0.4, fill: true, pointRadius: 3, pointHoverRadius: 5, borderWidth: 2, hidden: detailView !== 'battery' },
    ];

    const yAxisLabel = { pressure: 'Pressure (PSI)', temperature: 'Temperature (°C)', battery: 'Battery (W)' };

    detailChartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: { labels: sortedLabels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: 'Live Tire Data', font: { size: 18, weight: 'bold' }, color: '#f2f5ff' },
          legend: { display: false },
          tooltip: { mode: 'index', intersect: false, backgroundColor: 'rgba(0, 0, 0, 0.8)', padding: 12 },
          zoom: {
            wheel: { enabled: true, speed: 0.1 },
            pinch: { enabled: true },
            mode: 'x',
          },
        },
        scales: {
          x: { title: { display: true, text: 'Time', font: { size: 14, weight: 'bold' }, color: '#9ba3c7' }, grid: { color: 'rgba(31, 34, 53, 0.3)' }, ticks: { color: '#9ba3c7' } },
          y: { title: { display: true, text: yAxisLabel[detailView], font: { size: 14, weight: 'bold' }, color: '#9ba3c7' }, grid: { color: 'rgba(31, 34, 53, 0.3)' }, ticks: { color: '#9ba3c7' }, beginAtZero: false },
        },
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
      },
    });

    return () => {
      if (detailChartInstanceRef.current) {
        detailChartInstanceRef.current.destroy();
      }
    };
  }, [selectedTire, dataHistory, detailView]);

  const calculateTirePositions = useCallback(() => {
    if (!config) return [];
    const positions = [];
    const truckLength = 52;
    const truckFrontX = 19;
    const numAxles = config.axleConfig.length;
    const axleSpacing = numAxles > 1 ? truckLength / (numAxles - 1) : 0;

    for (let i = 0; i < numAxles; i++) {
      const axleX = truckFrontX + i * axleSpacing;
      const numTiresOnAxle = config.axleConfig[i];
      const tiresPerSide = numTiresOnAxle / 2;
      const sideHeight = 16;

      for (let j = 0; j < tiresPerSide; j++) {
        const currentX = axleX;
        positions.push({ x: currentX, y: 16.5 - j * sideHeight });
        positions.push({ x: currentX, y: 68.5 + j * sideHeight });
      }
    }
    return positions;
  }, [config]);

  const handleZoom = useCallback((chartRef, direction) => {
    const chart = chartRef.current;
    if (!chart) return;
    const factor = direction === 'in' ? 1.2 : 0.8;
    chart.zoom(factor, 'none');
  }, []);

  const handleZoomReset = useCallback((chartRef) => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.resetZoom('none');
  }, []);

  const cycleDetailView = useCallback((direction) => {
    const views = ['pressure', 'temperature', 'battery'];
    const currentIndex = views.indexOf(detailView);
    const newIndex = direction === 'next'
      ? (currentIndex + 1) % views.length
      : (currentIndex - 1 + views.length) % views.length;
    setDetailView(views[newIndex]);
  }, [detailView]);

  if (!config) {
    return (
      <div className="tpms-page">
        <div className="tpms-container">
          <h1>TPMS Dashboard</h1>
          <p>No tire configuration found. Please configure from the CAN Console.</p>
          <button className="btn-primary" onClick={() => navigate('/')}>Go to CAN Console</button>
        </div>
        <style>{globalStyles}</style>
      </div>
    );
  }

  const positions = calculateTirePositions();

  return (
    <div className="tpms-page">
      <style>{globalStyles}</style>
      <div className="tpms-container">
        <header className="tpms-header">
          <h1>TPMS Dashboard</h1>
          <div className="header-controls">
            <button className="btn-secondary" onClick={() => navigate('/')}>Back to Main</button>
          </div>
        </header>

        <div className="truck-view-section">
          <div className="view-selector-header">
            <div className="view-toggle">
              <button className={`view-btn ${view === 'top-view' ? 'active' : ''}`} onClick={() => setView('top-view')}>Top View</button>
              <button className={`view-btn ${view === 'data-view' ? 'active' : ''}`} onClick={() => setView('data-view')}>Data View</button>
            </div>
          </div>

          {view === 'top-view' ? (
            <div className="truck-container-wrapper">
              <div className="truck-2d-view">
                <div className="truck-body-container">
                  <div className="truck-body">
                    <div className="truck-cab"></div>
                    <div className="truck-trailer"></div>
                  </div>
                </div>
                {positions.map((pos, idx) => {
                  const tireNum = idx + 1;
                  const tire = tireData[tireNum];
                  const status = tire?.status || 'normal';
                  return (
                    <div
                      key={tireNum}
                      className={`tire ${status}`}
                      onClick={() => setSelectedTire(tireNum)}
                      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                    >
                      <div className="tire-label">T{tireNum}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="data-view-container">
              {Object.values(tireData).map((tire) => (
                <div key={tire.id} className={`data-box ${tire.status}`} onClick={() => setSelectedTire(tire.id)}>
                  <h3>Tire {tire.id} - {tire.position}</h3>
                  <div className="details">
                    <div className="detail-item"><span>Pressure:</span><span>{tire.pressure.toFixed(1)} PSI</span></div>
                    <div className="detail-item"><span>Temperature:</span><span>{tire.temperature.toFixed(1)} °C</span></div>
                    <div className="detail-item"><span>Battery:</span><span>{tire.battery.toFixed(2)} W</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="graph-section">
          <div className="graph-header">
            <h2>Data Visualization</h2>
            <div className="graph-selector">
              <label htmlFor="graph-type">Select Metric:</label>
              <select id="graph-type" className="graph-dropdown" value={selectedMetric} onChange={(e) => setSelectedMetric(e.target.value)}>
                <option value="pressure">Pressure (PSI)</option>
                <option value="temperature">Temperature (°C)</option>
                <option value="battery">Battery Level (W)</option>
              </select>
            </div>
          </div>
          <div className="zoom-controls">
            <button className="zoom-btn" onClick={() => handleZoom(mainChartInstanceRef, 'in')} title="Zoom In">+</button>
            <button className="zoom-btn" onClick={() => handleZoom(mainChartInstanceRef, 'out')} title="Zoom Out">-</button>
            <button className="zoom-btn" onClick={() => handleZoomReset(mainChartInstanceRef)} title="Reset Zoom">Reset</button>
            <span className="zoom-hint">Drag to pan, Scroll to zoom</span>
          </div>
          <div className="graph-container">
            <canvas ref={mainChartRef}></canvas>
          </div>
        </div>

        <div className="table-section">
          <h2>Tire Data Table</h2>
          <div className="table-wrapper">
            <table id="tpms-table">
              <thead>
                <tr>
                  <th>Tire #</th>
                  <th>Position</th>
                  <th>Pressure (PSI)</th>
                  <th>Temperature (°C)</th>
                  <th>Battery (W)</th>
                  <th>Last Update</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(tireData).map((tire) => (
                  <tr key={tire.id}>
                    <td><strong>{tire.id}</strong></td>
                    <td><strong>{tire.position}</strong></td>
                    <td>{tire.pressure.toFixed(1)}</td>
                    <td>{tire.temperature.toFixed(1)}</td>
                    <td>{tire.battery.toFixed(2)} W</td>
                    <td>{tire.lastUpdate.toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedTire !== null && (
        <div className="modal" onClick={(e) => e.target.className === 'modal' && setSelectedTire(null)}>
          <div className="modal-content tire-detail-modal-content">
            <span className="close-tire-detail" onClick={() => setSelectedTire(null)}>&times;</span>
            <h2 id="tire-detail-title">Tire {selectedTire} - {tireData[selectedTire]?.position}</h2>

            <div className="tire-detail-cards">
              <div className="data-card pressure-card">
                <div className="card-icon">📊</div>
                <div className="card-label">Pressure</div>
                <div className="card-value">{tireData[selectedTire]?.pressure?.toFixed(1) || '0.0'}</div>
                <div className="card-unit">PSI</div>
              </div>
              <div className="data-card temperature-card">
                <div className="card-icon">🌡️</div>
                <div className="card-label">Temperature</div>
                <div className="card-value">{tireData[selectedTire]?.temperature?.toFixed(1) || '0.0'}</div>
                <div className="card-unit">°C</div>
              </div>
              <div className="data-card battery-card">
                <div className="card-icon">🔋</div>
                <div className="card-label">Battery</div>
                <div className="card-value">{tireData[selectedTire]?.battery?.toFixed(2) || '0.00'}</div>
                <div className="card-unit">W</div>
              </div>
            </div>

            <div className="tire-detail-graph-section">
              <div className="graph-controls-header">
                <h3>Live Data Graph</h3>
                <div className="view-selector">
                  <button className="arrow-btn" onClick={() => cycleDetailView('prev')} title="Previous View">◀</button>
                  <select id="tire-detail-view-selector" className="view-selector-dropdown" value={detailView} onChange={(e) => setDetailView(e.target.value)}>
                    <option value="pressure">Pressure</option>
                    <option value="temperature">Temperature</option>
                    <option value="battery">Battery</option>
                  </select>
                  <button className="arrow-btn" onClick={() => cycleDetailView('next')} title="Next View">▶</button>
                </div>
              </div>
              <div className="zoom-controls">
                <button className="zoom-btn" onClick={() => handleZoom(detailChartInstanceRef, 'in')} title="Zoom In">+</button>
                <button className="zoom-btn" onClick={() => handleZoom(detailChartInstanceRef, 'out')} title="Zoom Out">-</button>
                <button className="zoom-btn" onClick={() => handleZoomReset(detailChartInstanceRef)} title="Reset Zoom">Reset</button>
                <span className="zoom-hint">Drag to pan, Scroll to zoom</span>
              </div>
              <div className="tire-detail-graph-container">
                <canvas ref={detailChartRef}></canvas>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const globalStyles = `
  :root {
    --bg: #05060a;
    --card-bg: #111423;
    --card-border: #1f2235;
    --accent: #5cc8ff;
    --accent-strong: #2cb1ff;
    --danger: #ff5c6a;
    --success: #29d98c;
    --warning: #ff9800;
    --text: #f2f5ff;
    --muted: #9ba3c7;
  }

  .tpms-page {
    font-family: 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    background: radial-gradient(circle at 10% 20%, rgba(92, 200, 255, 0.15), transparent 40%),
                radial-gradient(circle at 80% 0, rgba(255, 92, 106, 0.12), transparent 45%),
                var(--bg);
    min-height: 100vh;
    padding: 20px;
    color: var(--text);
  }

  .tpms-container {
    max-width: 1400px;
    margin: 0 auto;
    background: var(--card-bg);
    border-radius: 16px;
    border: 1px solid var(--card-border);
    box-shadow: 0 30px 60px rgba(0, 0, 0, 0.35);
    overflow: hidden;
  }

  .tpms-header {
    background: var(--card-bg);
    border-bottom: 1px solid var(--card-border);
    color: var(--text);
    padding: 30px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 20px;
  }

  .tpms-header h1 {
    font-size: 2.4rem;
    font-weight: bold;
    margin: 0;
    letter-spacing: 0.04em;
  }

  .btn-primary, .btn-secondary {
    padding: 12px 24px;
    border: none;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
  }

  .btn-primary {
    background: linear-gradient(135deg, var(--accent), var(--accent-strong));
    color: #02111c;
  }

  .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 12px rgba(92, 200, 255, 0.3); }

  .btn-secondary {
    background: transparent;
    border: 1px solid var(--card-border);
    color: var(--muted);
  }

  .btn-secondary:hover { transform: translateY(-2px); border-color: var(--accent); color: var(--text); }

  .truck-view-section {
    padding: 40px;
    background: var(--bg);
    border-bottom: 1px solid var(--card-border);
  }

  .view-selector-header {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 20px;
    gap: 20px;
  }

  .view-toggle {
    display: flex;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid var(--card-border);
  }

  .view-btn {
    padding: 10px 20px;
    border: none;
    background-color: var(--card-bg);
    color: var(--muted);
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 16px;
    font-weight: 600;
  }

  .view-btn.active {
    background: linear-gradient(135deg, var(--accent), var(--accent-strong));
    color: #02111c;
  }

  .view-btn:hover:not(.active) { background-color: #1a1d2e; color: var(--text); }

  .truck-container-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 40px;
    background: var(--card-bg);
    border-radius: 12px;
    border: 1px solid var(--card-border);
  }

  .truck-2d-view {
    position: relative;
    width: 100%;
    max-width: 900px;
    height: 400px;
    margin: 0 auto;
    background: linear-gradient(to bottom, #1a1d2e 0%, #111423 100%);
    border-radius: 12px;
    border: 2px solid var(--card-border);
    overflow: hidden;
  }

  .truck-body-container {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 70%;
    height: 35%;
  }

  .truck-body {
    width: 100%;
    height: 100%;
    display: flex;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: inset 0 2px 4px rgba(255, 255, 255, 0.05), 0 4px 8px rgba(0, 0, 0, 0.3);
  }

  .truck-cab {
    width: 28%;
    height: 100%;
    background: linear-gradient(135deg, #1a252f 0%, #2c3e50 100%);
    border-right: 3px solid #1a252f;
    position: relative;
  }

  .truck-trailer {
    flex: 1;
    height: 100%;
    background: linear-gradient(135deg, #34495e 0%, #2c3e50 100%);
    position: relative;
  }

  .tire {
    position: absolute;
    width: 120px;
    height: 60px;
    background-color: #2a2a2a;
    background-image: repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 3px, transparent 3px, transparent 8px),
                      radial-gradient(circle at center, #6d6d6d, #2a2a2a);
    border-radius: 10%;
    border: 4px solid #1c1c1c;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.3), inset 0 2px 4px rgba(255, 255, 255, 0.2);
    z-index: 10;
    padding: 8px;
    overflow: hidden;
    transform: translate(-50%, -50%);
  }

  .tire::before {
    content: '';
    position: absolute;
    width: 30%;
    height: 60%;
    border-radius: 50%;
    border: 3px solid rgba(255, 255, 255, 0.1);
    background: radial-gradient(circle, rgba(255, 255, 255, 0.15) 0%, transparent 60%);
    box-shadow: inset 0 0 10px rgba(0,0,0,0.5);
  }

  .tire:hover { transform: translate(-50%, -50%) scale(1.1); box-shadow: 0 6px 15px rgba(0, 0, 0, 0.4); z-index: 20; }

  .tire.normal { border-color: var(--success); }

  .tire.warning {
    border-color: var(--warning);
    background-image: repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 3px, transparent 3px, transparent 8px),
                      radial-gradient(circle at 30% 30%, #ffe0b2, #ff9800);
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.3), 0 0 15px rgba(255, 152, 0, 0.5), inset 0 2px 4px rgba(255, 255, 255, 0.3);
    animation: pulse-warning 2s infinite;
  }

  .tire.critical {
    border-color: var(--danger);
    background-image: repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 3px, transparent 3px, transparent 8px),
                      radial-gradient(circle at 30% 30%, #ffcdd2, #f44336);
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.3), 0 0 20px rgba(244, 67, 54, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.3);
    animation: pulse-critical 1s infinite;
  }

  @keyframes pulse-warning { 0%, 100% { transform: translate(-50%, -50%) scale(1); } 50% { transform: translate(-50%, -50%) scale(1.05); } }
  @keyframes pulse-critical { 0%, 100% { transform: translate(-50%, -50%) scale(1); } 50% { transform: translate(-50%, -50%) scale(1.1); } }

  .tire-label {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    font-weight: bold;
    font-size: 14px;
    color: #ffffff;
    text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.7);
    z-index: 2;
    position: relative;
    background: rgba(0, 0, 0, 0.4);
    padding: 7px 8px;
    border-radius: 50%;
    letter-spacing: 0.5px;
    margin-bottom: 5px;
  }

  .tire-value {
    font-size: 11px;
    color: #f0f0f0;
    font-weight: 600;
    line-height: 1.4;
    text-align: center;
    z-index: 2;
    position: relative;
    padding: 2px 4px;
    border-radius: 3px;
  }

  .data-view-container {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
    padding: 20px;
    background: var(--bg);
    border-radius: 12px;
  }

  .data-box {
    background: var(--card-bg);
    border-radius: 12px;
    padding: 20px;
    border: 1px solid var(--card-border);
    border-left: 5px solid;
    transition: all 0.3s ease;
    cursor: pointer;
  }

  .data-box:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3); }

  .data-box.normal { border-left-color: var(--success); }
  .data-box.warning { border-left-color: var(--warning); }
  .data-box.critical { border-left-color: var(--danger); }

  .data-box h3 { margin-bottom: 15px; font-size: 1.2em; color: var(--text); }

  .data-box .details { display: flex; flex-direction: column; gap: 10px; }

  .data-box .detail-item { display: flex; justify-content: space-between; font-size: 1em; color: var(--muted); }
  .data-box .detail-item span:last-child { color: var(--text); font-weight: 600; }

  .graph-section {
    padding: 40px;
    background: var(--card-bg);
    border-bottom: 1px solid var(--card-border);
  }

  .graph-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 25px;
    flex-wrap: wrap;
    gap: 20px;
  }

  .graph-header h2 { font-size: 1.8em; color: var(--text); margin: 0; }

  .graph-selector { display: flex; align-items: center; gap: 15px; }
  .graph-selector label { font-weight: bold; color: var(--muted); font-size: 16px; }

  .graph-dropdown {
    padding: 12px 20px;
    border: 1px solid var(--card-border);
    border-radius: 10px;
    font-size: 16px;
    background: #080b16;
    color: var(--text);
    cursor: pointer;
    transition: all 0.3s ease;
    min-width: 250px;
  }

  .graph-dropdown:hover { border-color: var(--accent); }
  .graph-dropdown:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(92, 200, 255, 0.2); }

  .zoom-controls { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; flex-wrap: wrap; }

  .zoom-btn {
    background: var(--card-bg);
    color: var(--accent);
    border: 1px solid var(--card-border);
    border-radius: 8px;
    padding: 8px 16px;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .zoom-btn:hover { background: var(--accent); color: #02111c; border-color: var(--accent); transform: translateY(-2px); }

  .zoom-hint { margin-left: auto; font-size: 12px; color: var(--muted); font-style: italic; }

  .graph-container {
    position: relative;
    height: 400px;
    background: #080b16;
    border-radius: 12px;
    padding: 20px;
    border: 1px solid var(--card-border);
  }

  .table-section { padding: 40px; background: var(--bg); }

  .table-section h2 { text-align: center; margin-bottom: 30px; font-size: 1.8em; color: var(--text); }

  .table-wrapper {
    overflow-x: auto;
    background: var(--card-bg);
    border-radius: 12px;
    border: 1px solid var(--card-border);
    padding: 0;
  }

  #tpms-table { width: 100%; border-collapse: collapse; font-size: 14px; font-family: 'Fira Code', Consolas, monospace; }

  #tpms-table thead {
    background: linear-gradient(135deg, var(--accent), var(--accent-strong));
    color: #02111c;
  }

  #tpms-table th {
    padding: 15px;
    text-align: left;
    font-weight: bold;
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  #tpms-table tbody tr { border-bottom: 1px solid var(--card-border); transition: all 0.2s ease; }
  #tpms-table tbody tr:hover { background-color: rgba(92, 200, 255, 0.05); }
  #tpms-table tbody tr:nth-child(even) { background-color: rgba(0, 0, 0, 0.2); }
  #tpms-table tbody tr:nth-child(even):hover { background-color: rgba(92, 200, 255, 0.08); }

  #tpms-table td { padding: 15px; color: var(--text); }

  .modal {
    display: flex;
    position: fixed;
    z-index: 1000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(5px);
    animation: fadeIn 0.3s ease;
    align-items: center;
    justify-content: center;
  }

  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

  .modal-content {
    background: var(--card-bg);
    padding: 40px;
    border-radius: 16px;
    border: 1px solid var(--card-border);
    width: 90%;
    max-width: 500px;
    box-shadow: 0 30px 60px rgba(0, 0, 0, 0.4);
    animation: slideDown 0.3s ease;
    position: relative;
    color: var(--text);
  }

  @keyframes slideDown {
    from { transform: translateY(-50px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .tire-detail-modal-content {
    max-width: 1000px !important;
    max-height: 95vh;
    overflow-y: auto;
    padding: 30px 40px !important;
    width: 95% !important;
  }

  .close-tire-detail {
    position: absolute;
    right: 20px;
    top: 20px;
    font-size: 32px;
    font-weight: bold;
    color: var(--muted);
    cursor: pointer;
    transition: all 0.3s ease;
    z-index: 10;
  }

  .close-tire-detail:hover { color: var(--text); transform: scale(1.1); }

  .tire-detail-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 25px 0; }

  .data-card {
    background: #080b16;
    border-radius: 12px;
    padding: 25px;
    text-align: center;
    color: var(--text);
    border: 2px solid var(--card-border);
    transition: all 0.3s ease;
  }

  .data-card:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3); }

  .pressure-card { border-color: var(--success); background: linear-gradient(135deg, rgba(41, 217, 140, 0.1) 0%, #080b16 100%); }
  .temperature-card { border-color: var(--warning); background: linear-gradient(135deg, rgba(255, 152, 0, 0.1) 0%, #080b16 100%); }
  .battery-card { border-color: var(--accent); background: linear-gradient(135deg, rgba(92, 200, 255, 0.1) 0%, #080b16 100%); }

  .card-icon { font-size: 40px; margin-bottom: 10px; }
  .card-label { font-size: 14px; color: var(--muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
  .card-value { font-size: 36px; font-weight: bold; margin-bottom: 5px; color: var(--text); }
  .card-unit { font-size: 14px; color: var(--muted); }

  .tire-detail-graph-section { margin-top: 30px; padding-top: 30px; border-top: 2px solid var(--card-border); }

  .graph-controls-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    flex-wrap: wrap;
    gap: 15px;
  }

  .tire-detail-graph-section h3 { margin: 0; color: var(--text); font-size: 1.5em; }

  .view-selector { display: flex; align-items: center; gap: 10px; }

  .arrow-btn {
    background: var(--card-bg);
    color: var(--accent);
    border: 1px solid var(--card-border);
    border-radius: 8px;
    width: 40px;
    height: 40px;
    font-size: 18px;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .arrow-btn:hover { background: var(--accent); color: #02111c; border-color: var(--accent); transform: scale(1.05); }

  .view-selector-dropdown {
    padding: 10px 15px;
    border: 1px solid var(--card-border);
    border-radius: 8px;
    font-size: 14px;
    background: #080b16;
    color: var(--text);
    cursor: pointer;
    transition: all 0.3s ease;
    min-width: 180px;
  }

  .view-selector-dropdown:hover { border-color: var(--accent); }
  .view-selector-dropdown:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(92, 200, 255, 0.2); }

  .tire-detail-graph-container {
    position: relative;
    height: 450px;
    background: #080b16;
    border-radius: 12px;
    padding: 20px;
    border: 1px solid var(--card-border);
    margin-bottom: 15px;
  }

  @media (max-width: 768px) {
    .tpms-header { flex-direction: column; text-align: center; }
    .tpms-header h1 { font-size: 1.8em; }
    .truck-2d-view { height: 300px; }
    .truck-container-wrapper { padding: 20px; }
    .tire { width: 80px; height: 50px; }
    .tire-label { font-size: 12px; padding: 5px 6px; }
    .tire-value { font-size: 9px; }
    .tire-detail-cards { grid-template-columns: 1fr; }
    .graph-header { flex-direction: column; align-items: flex-start; }
    .graph-selector { width: 100%; }
    .graph-dropdown { width: 100%; }
    .table-section, .graph-section, .truck-view-section { padding: 20px; }
  }

  @media (max-width: 480px) {
    .tire { width: 60px; height: 40px; }
    .tire-label { font-size: 10px; padding: 4px 5px; }
    .tire-value { font-size: 8px; }
    .tire-detail-modal-content { padding: 20px !important; }
    .graph-controls-header { flex-direction: column; align-items: flex-start; }
  }
`;

export default TPMSDashboard;
