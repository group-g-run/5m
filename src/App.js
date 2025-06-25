import React, { useState, useMemo, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, AreaChart, Area } from 'recharts';
import Papa from 'papaparse';
import './App.css';

const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084d0', '#87d068', '#ffb347', '#ff6b6b', '#4ecdc4'];
const MILE_TO_KM = 1.60934;

const timeToTotalSeconds = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return NaN;
  const parts = timeStr.split(':').map(Number);
  if (parts.some(isNaN)) return NaN;
  let seconds = 0;
  if (parts.length === 3) { seconds = parts[0] * 3600 + parts[1] * 60 + parts[2]; }
  else if (parts.length === 2) { seconds = parts[0] * 60 + parts[1]; }
  else { return NaN; }
  return seconds;
};

const secondsToPace = (totalSecondsPerMile, unit = 'mile') => {
  if (isNaN(totalSecondsPerMile) || totalSecondsPerMile === null) return 'N/A';
  let convertedSeconds = totalSecondsPerMile;
  if (unit === 'km') {
    convertedSeconds /= MILE_TO_KM;
  }
  const minutes = Math.floor(Math.abs(convertedSeconds) / 60);
  const seconds = Math.round(Math.abs(convertedSeconds) % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const processData = (data) => {
  return data
    .filter(row => row.runner && row.year && row.time && row.event)
    .map(row => {
      const totalSeconds = timeToTotalSeconds(String(row.time).trim());
      const distance = parseFloat(row.event);
      if (isNaN(totalSeconds) || isNaN(distance) || distance === 0) {
          return { ...row, paceInSeconds: NaN };
      }
      const paceInSecondsPerMile = totalSeconds / distance;
      return {
        runner: String(row.runner).trim(),
        year: parseInt(row.year),
        paceInSeconds: paceInSecondsPerMile,
        event: String(row.event).trim()
      }
    })
    .filter(row => !isNaN(row.year) && !isNaN(row.paceInSeconds));
};

function App() {
  const [raceData, setRaceData] = useState([]); 
  const [selectedRunners, setSelectedRunners] = useState(new Set());
  const [selectedYear, setSelectedYear] = useState('all');
  const [viewMode, setViewMode] = useState('trends');
  const [paceUnit, setPaceUnit] = useState('mile');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const csvFilePath = `${process.env.PUBLIC_URL}/race_data.csv`;
    Papa.parse(csvFilePath, {
      download: true, header: true, skipEmptyLines: true,
      complete: (results) => {
        try {
          const cleanedData = processData(results.data);
          if (cleanedData.length === 0) {
            setError('No valid data found. Check race_data.csv for runner, year, time, and event columns.');
            setIsLoading(false); return;
          }
          setRaceData(cleanedData);
          setIsLoading(false);
        } catch (err) {
          setError('Error processing CSV file: ' + err.message);
          setIsLoading(false);
        }
      },
      error: (err) => {
        setError(`Could not load race_data.csv. Ensure it's in the 'public' folder. Error: ${err.message}`);
        setIsLoading(false);
      }
    });
  }, []);

  const runners = [...new Set(raceData.map(d => d.runner))];
  const years = [...new Set(raceData.map(d => d.year))].sort();

  const trendData = useMemo(() => {
    const yearlyData = {};
    raceData.forEach(record => {
      if (!yearlyData[record.year]) { yearlyData[record.year] = { year: record.year }; }
      yearlyData[record.year][record.runner] = record.paceInSeconds;
    });
    return Object.values(yearlyData).sort((a, b) => a.year - b.year);
  }, [raceData]);

  const yAxisDomain = useMemo(() => {
    if (isLoading || raceData.length === 0) return ['auto', 'auto'];
    const dataToConsider = selectedRunners.size > 0 ? raceData.filter(d => selectedRunners.has(d.runner)) : raceData;
    if (dataToConsider.length === 0) return ['auto', 'auto'];
    const allPaces = dataToConsider.map(d => d.paceInSeconds);
    const minPace = Math.min(...allPaces);
    const maxPace = Math.max(...allPaces);
    const padding = (maxPace - minPace) * 0.05;
    return [Math.max(0, minPace - padding), maxPace + padding];
  }, [raceData, selectedRunners, isLoading]);

  const comparisonData = useMemo(() => {
    if (selectedYear === 'all') return [];
    return raceData.filter(d => d.year === parseInt(selectedYear)).sort((a, b) => a.paceInSeconds - b.paceInSeconds).map(d => ({ runner: d.runner.split(' ')[0], paceInSeconds: d.paceInSeconds, fullName: d.runner }));
  }, [selectedYear, raceData]);

  const paceDistributionData = useMemo(() => {
    return years.map(year => {
      const pacesInYear = raceData.filter(d => d.year === year).map(d => d.paceInSeconds).sort((a, b) => a - b);
      if (pacesInYear.length === 0) return null;
      const minPace = pacesInYear[0];
      const maxPace = pacesInYear[pacesInYear.length - 1];
      const midIndex = Math.floor(pacesInYear.length / 2);
      const medianPace = pacesInYear.length % 2 === 0 ? (pacesInYear[midIndex - 1] + pacesInYear[midIndex]) / 2 : pacesInYear[midIndex];
      return { year, minPace, medianPace, maxPace };
    }).filter(Boolean);
  }, [raceData, years]);

  const bumpChartData = useMemo(() => {
    const yearlyRanks = {};
    years.forEach(year => {
      const yearlyData = raceData.filter(d => d.year === year).sort((a, b) => a.paceInSeconds - b.paceInSeconds);
      yearlyRanks[year] = { year };
      yearlyData.forEach((d, index) => { yearlyRanks[year][d.runner] = index + 1; });
    });
    return Object.values(yearlyRanks);
  }, [raceData, years]);

  // NEW: Calculation for Year-over-Year improvements, FILTERED for motivation
  const yearOverYearImprovers = useMemo(() => {
      if (years.length < 2) return [];
      const latestYear = years[years.length - 1];
      const previousYear = years[years.length - 2];
      return runners.map(runner => {
          const latestData = raceData.find(d => d.runner === runner && d.year === latestYear);
          const previousData = raceData.find(d => d.runner === runner && d.year === previousYear);
          if (!latestData || !previousData) return null;
          const improvement = previousData.paceInSeconds - latestData.paceInSeconds;
          const improvementPercent = ((improvement / previousData.paceInSeconds) * 100).toFixed(1);
          return { runner, improvement, improvementPercent, latestPace: latestData.paceInSeconds, previousPace: previousData.paceInSeconds, isImprovement: improvement > 0 };
      }).filter(Boolean).filter(stat => stat.isImprovement); // Only keep those who improved
  }, [raceData, years, runners]);
  
  // NEW: Calculation for Overall improvements, FILTERED for motivation
  const overallImprovers = useMemo(() => {
      return runners.map(runner => {
          const runnerData = raceData.filter(d => d.runner === runner).sort((a, b) => a.year - b.year);
          if (runnerData.length < 2) return null;
          const firstPace = runnerData[0].paceInSeconds;
          const lastPace = runnerData[runnerData.length - 1].paceInSeconds;
          const improvement = firstPace - lastPace;
          const improvementPercent = ((improvement / firstPace) * 100).toFixed(1);
          return { runner, improvement, improvementPercent, firstPace, lastPace, isImprovement: improvement > 0 };
      }).filter(Boolean).filter(stat => stat.isImprovement); // Only keep those who improved
  }, [runners, raceData]);

  const handleRunnerToggle = (runner) => {
    const newSelected = new Set(selectedRunners);
    if (newSelected.has(runner)) newSelected.delete(runner);
    else newSelected.add(runner);
    setSelectedRunners(newSelected);
  };
  
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: '24px' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        
        <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '30px', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>Race Performance Dashboard</h1>
          <div style={{ padding: '8px', textAlign: 'center', backgroundColor: '#f3f4f6', borderRadius: '6px' }}>
              {isLoading && <p style={{ color: '#3b82f6' }}>Loading data...</p>}
              {error && <p style={{ color: '#dc2626' }}>⚠️ {error}</p>}
              {!isLoading && !error && <p style={{ color: '#166534' }}>✅ Displaying {raceData.length} records</p>}
          </div>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setViewMode('trends')} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: viewMode === 'trends' ? '#3b82f6' : '#e5e7eb', color: viewMode === 'trends' ? 'white' : '#374151', cursor: 'pointer' }}>📈 Trends</button>
              <button onClick={() => setViewMode('comparison')} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: viewMode === 'comparison' ? '#3b82f6' : '#e5e7eb', color: viewMode === 'comparison' ? 'white' : '#374151', cursor: 'pointer' }}>👥 Comparison</button>
            </div>
            <button onClick={() => setPaceUnit(paceUnit === 'mile' ? 'km' : 'mile')} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #3b82f6', backgroundColor: 'white', color: '#3b82f6', cursor: 'pointer', fontWeight: '500' }}>Show Pace: min/{paceUnit}</button>
            {viewMode === 'comparison' && (
              <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', marginLeft: 'auto' }}>
                <option value="all">Select Year</option>
                {years.map(year => <option key={year} value={year}>{year}</option>)}
              </select>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '24px', marginBottom: '24px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>🔍 Select Runners</h3>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {runners.map((runner, index) => (
                <label key={runner} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '8px', borderRadius: '4px', marginBottom: '4px' }}>
                  <input type="checkbox" checked={selectedRunners.has(runner)} onChange={() => handleRunnerToggle(runner)} style={{ borderRadius: '4px' }}/>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: colors[index % colors.length] }}></div>
                    <span style={{ fontSize: '14px' }}>{runner}</span>
                  </div>
                </label>
              ))}
            </div>
            <button onClick={() => setSelectedRunners(new Set(runners))} style={{ marginTop: '16px', width: '100%', padding: '8px 12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>Select All</button>
            <button onClick={() => setSelectedRunners(new Set())} style={{ marginTop: '8px', width: '100%', padding: '8px 12px', backgroundColor: '#d1d5db', color: '#374151', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>Clear All</button>
          </div>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px' }}>
            {viewMode === 'trends' ? (
                <>{/* Trends Chart */}</>
            ) : (
                <>{/* Comparison Chart */}</>
            )}
          </div>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Group Pace Distribution Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={paceDistributionData}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="year" />
              <YAxis label={{ value: `Pace (min/${paceUnit})`, angle: -90, position: 'insideLeft' }} tickFormatter={(seconds) => secondsToPace(seconds, paceUnit)} reversed={true} />
              <Tooltip formatter={(value, name) => [secondsToPace(value, paceUnit), name.replace('Pace', ' Pace')]} />
              <Legend /><Area type="monotone" dataKey="maxPace" stroke="#ff7300" fill="#ff7300" fillOpacity={0.1} name="Slowest Pace" />
              <Area type="monotone" dataKey="minPace" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.2} name="Fastest Pace" />
              <Line type="monotone" dataKey="medianPace" stroke="#8884d8" strokeWidth={3} name="Median Pace" dot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Annual Ranking Changes</h3>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={bumpChartData}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="year" allowDecimals={false} />
              <YAxis label={{ value: 'Rank', angle: -90, position: 'insideLeft' }} reversed={true} allowDecimals={false} />
              <Tooltip /><Legend />
              {runners.map((runner, index) => (
                <Line key={runner} type="monotone" dataKey={runner} stroke={colors[index % colors.length]} strokeWidth={selectedRunners.has(runner) ? 4 : 2} opacity={selectedRunners.size === 0 || selectedRunners.has(runner) ? 1 : 0.3} dot={{ r: 4 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* NEW: Motivational Improvement Panels */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
              🏆 Annual Pace Busters {years.length >= 2 && `(${years[years.length-2]} vs ${years[years.length-1]})`}
            </h3>
            {yearOverYearImprovers.length > 0 ? (
              <div style={{ display: 'grid', gap: '16px' }}>
                {yearOverYearImprovers.map((stat) => (
                  <div key={stat.runner} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <h4 style={{ fontWeight: '500' }}>{stat.runner}</h4>
                      <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', backgroundColor: '#dcfce7', color: '#166534' }}>
                        ↓ {secondsToPace(stat.improvement, paceUnit)}
                      </span>
                    </div>
                    <div style={{ fontSize: '14px', color: '#6b7280' }}>
                      <p>From: {secondsToPace(stat.previousPace, paceUnit)} → To: {secondsToPace(stat.latestPace, paceUnit)}</p>
                      <p style={{ color: '#059669', fontWeight: '500' }}>Pace improved by {stat.improvementPercent}%!</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#6b7280' }}>No year-over-year improvements recorded. A great baseline for next year!</p>
            )}
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
              🚀 All-Time Improvers
            </h3>
            {overallImprovers.length > 0 ? (
              <div style={{ display: 'grid', gap: '16px' }}>
                {overallImprovers.map((stat) => (
                  <div key={stat.runner} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <h4 style={{ fontWeight: '500' }}>{stat.runner}</h4>
                      <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', backgroundColor: '#dcfce7', color: '#166534' }}>
                         ↓ {secondsToPace(stat.improvement, paceUnit)}
                      </span>
                    </div>
                    <div style={{ fontSize: '14px', color: '#6b7280' }}>
                      <p>From: {secondsToPace(stat.firstPace, paceUnit)} → To: {secondsToPace(stat.lastPace, paceUnit)}</p>
                      <p style={{ color: '#059669', fontWeight: '500' }}>Pace improved by {stat.improvementPercent}% overall!</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#6b7280' }}>No overall improvements recorded yet. Keep on running!</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;