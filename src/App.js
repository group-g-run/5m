import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import Papa from 'papaparse';
import './App.css';

// Sample data for demo
const sampleRaceData = [
    { runner: 'Ruth', year: 2023, pace: '0:08:59', event: '5' },
    { runner: 'Ruth', year: 2024, pace: '0:08:03', event: '5' },
    { runner: 'Ruth', year: 2025, pace: '0:07:44', event: '5' },
    { runner: 'Maria', year: 2023, pace: '0:07:33', event: '5' },
    { runner: 'Maria', year: 2024, pace: '0:11:57', event: '5' },
    { runner: 'Maria', year: 2025, pace: '0:10:57', event: '5' },
    { runner: 'Eoin', year: 2023, pace: '0:07:33', event: '5' },
    { runner: 'Eoin', year: 2024, pace: '0:07:54', event: '5' },
    { runner: 'Eoin', year: 2025, pace: '0:07:59', event: '5' },
    { runner: 'Jim', year: 2023, pace: '0:07:47', event: '5' },
    { runner: 'Jim', year: 2024, pace: '0:07:59', event: '5' },
    { runner: 'Patrick', year: 2024, pace: '0:07:43', event: '5' },
    { runner: 'Patrick', year: 2023, pace: '0:07:41', event: '5' },
    { runner: 'Murt', year: 2023, pace: '0:11:10', event: '5' },
    { runner: 'Sarah', year: 2025, pace: '0:19:10', event: '3.67' },
    { runner: 'Dara', year: 2023, pace: '0:11:10', event: '5' },
];

const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084d0', '#87d068', '#ffb347', '#ff6b6b', '#4ecdc4'];

// CHANGED: Helper function to convert 'HH:MM:SS' or 'MM:SS' strings to total seconds for calculations.
const paceToSeconds = (paceStr) => {
  if (!paceStr || typeof paceStr !== 'string') return NaN;
  const parts = paceStr.split(':').map(Number);
  if (parts.some(isNaN)) return NaN;
  
  let seconds = 0;
  if (parts.length === 3) { // HH:MM:SS
    seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) { // MM:SS
    seconds = parts[0] * 60 + parts[1];
  } else {
      return NaN;
  }
  return seconds;
};

// CHANGED: Helper function to format total seconds back into a 'MM:SS' string for display.
const secondsToPace = (totalSeconds) => {
  if (isNaN(totalSeconds) || totalSeconds === null) return 'N/A';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// This function processes the raw data (from sample or CSV) into a usable format.
const processData = (data) => {
  return data
    // CHANGED: Filter for rows that have a 'pace' value instead of 'time'.
    .filter(row => row.runner && row.year && row.pace)
    .map(row => ({
      runner: String(row.runner).trim(),
      year: parseInt(row.year),
      // CHANGED: Keep the original pace string and add a calculated 'paceInSeconds' field.
      pace: String(row.pace).trim(),
      paceInSeconds: paceToSeconds(String(row.pace).trim()),
      event: row.event ? String(row.event).trim() : '5K'
    }))
    // CHANGED: Ensure the year and the calculated paceInSeconds are valid numbers.
    .filter(row => !isNaN(row.year) && !isNaN(row.paceInSeconds));
};

function App() {
  // CHANGED: Process the initial sample data using our new function.
  const [raceData, setRaceData] = useState(() => processData(sampleRaceData));
  const [selectedRunners, setSelectedRunners] = useState(new Set());
  const [selectedYear, setSelectedYear] = useState('all');
  const [viewMode, setViewMode] = useState('trends');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          // CHANGED: Use the central processing function.
          const cleanedData = processData(results.data);

          if (cleanedData.length === 0) {
            setError('No valid data found. Check your CSV format (runner, year, pace, event).');
            setIsLoading(false);
            return;
          }

          setRaceData(cleanedData);
          setSelectedRunners(new Set());
          setIsLoading(false);
        } catch (err) {
          setError('Error processing CSV file: ' + err.message);
          setIsLoading(false);
        }
      },
      error: (error) => {
        setError('Error reading CSV file: ' + error.message);
        setIsLoading(false);
      }
    });
  };

  const runners = [...new Set(raceData.map(d => d.runner))];
  const years = [...new Set(raceData.map(d => d.year))].sort();

  const trendData = useMemo(() => {
    const yearlyData = {};
    raceData.forEach(record => {
      if (!yearlyData[record.year]) {
        yearlyData[record.year] = { year: record.year };
      }
      // CHANGED: Use 'paceInSeconds' for the chart's Y-axis value.
      yearlyData[record.year][record.runner] = record.paceInSeconds;
    });
    return Object.values(yearlyData).sort((a, b) => a.year - b.year);
  }, [raceData]);

  const comparisonData = useMemo(() => {
    if (selectedYear === 'all') return [];
    return raceData
      .filter(d => d.year === parseInt(selectedYear))
      // CHANGED: Sort by 'paceInSeconds'.
      .sort((a, b) => a.paceInSeconds - b.paceInSeconds)
      .map(d => ({
        runner: d.runner.split(' ')[0],
        // CHANGED: Use 'paceInSeconds' for the bar height and pass the original 'pace' for the tooltip.
        paceInSeconds: d.paceInSeconds,
        pace: d.pace, 
        fullName: d.runner
      }));
  }, [selectedYear, raceData]);

  const improvements = useMemo(() => {
    return runners.map(runner => {
      const runnerData = raceData.filter(d => d.runner === runner).sort((a, b) => a.year - b.year);
      if (runnerData.length < 2) return null;
      
      // CHANGED: Use 'paceInSeconds' for all calculations.
      const firstPace = runnerData[0].paceInSeconds;
      const lastPace = runnerData[runnerData.length - 1].paceInSeconds;
      const improvement = firstPace - lastPace; // Positive value means faster (less time)
      const improvementPercent = ((improvement / firstPace) * 100).toFixed(1);
      
      return {
        runner,
        improvement, // in seconds
        improvementPercent,
        firstPace, // in seconds
        lastPace, // in seconds
        // A lower pace (fewer seconds) is an improvement.
        isImprovement: improvement > 0 
      };
    }).filter(Boolean).sort((a, b) => b.improvement - a.improvement);
  }, [runners, raceData]);

  const handleRunnerToggle = (runner) => {
    const newSelected = new Set(selectedRunners);
    if (newSelected.has(runner)) {
      newSelected.delete(runner);
    } else {
      newSelected.add(runner);
    }
    setSelectedRunners(newSelected);
  };
  
  // The old formatTime function is no longer needed, as we have secondsToPace.

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: '24px' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '30px', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>
            Race Performance Dashboard
          </h1>
          <p style={{ color: '#6b7280', marginBottom: '16px' }}>
            Track runner performance over time and compare results
          </p>
          
          {/* File Upload */}
          <div style={{ 
            border: '2px dashed #d1d5db', 
            borderRadius: '8px', 
            padding: '16px',
            textAlign: 'center'
          }}>
            <div style={{ marginBottom: '8px' }}>📤</div>
            <label style={{ cursor: 'pointer' }}>
              <span style={{ fontSize: '14px', color: '#6b7280' }}>
                Upload your CSV file or <span style={{ color: '#3b82f6', textDecoration: 'underline' }}>browse</span>
              </span>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </label>
            {/* CHANGED: Updated help text for CSV columns. */}
            <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
              CSV should have columns: runner, year, pace, event
            </p>
            
            {isLoading && (
              <div style={{ marginTop: '8px', color: '#3b82f6' }}>
                Loading your data...
              </div>
            )}
            
            {error && (
              <div style={{ marginTop: '8px', color: '#dc2626' }}>
                ⚠️ {error}
              </div>
            )}
            
            <div style={{ marginTop: '8px', fontSize: '14px', color: '#6b7280' }}>
              {/* CHANGED: Logic to detect sample data is slightly different now. */}
              Currently showing: {raceData.length === processData(sampleRaceData).length ? 'Sample data' : 'Your uploaded data'} ({raceData.length} records)
            </div>
          </div>
        </div>

        {/* Controls and Runner Selection are unchanged */}
        <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px', marginBottom: '24px' }}>
            {/* ... (no changes in this section) ... */}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '24px' }}>
            {/* Runner Selection - no changes needed here */}
            <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px' }}>
              {/* ... (no changes in this section) ... */}
            </div>

          {/* Main Chart */}
          <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px' }}>
            {viewMode === 'trends' ? (
              <>
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
                  Performance Trends Over Time
                </h3>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    {/* CHANGED: Updated YAxis to format seconds into MM:SS */}
                    <YAxis 
                      label={{ value: 'Pace (MM:SS)', angle: -90, position: 'insideLeft' }}
                      tickFormatter={secondsToPace}
                      reversed={true} // Lower pace (fewer seconds) is better, so it should be higher on the chart.
                    />
                    {/* CHANGED: Updated Tooltip to format value correctly */}
                    <Tooltip 
                      formatter={(value) => [secondsToPace(value), 'Pace']}
                      labelFormatter={(label) => `Year: ${label}`}
                    />
                    <Legend />
                    {runners.map((runner, index) => (
                      <Line
                        key={runner}
                        type="monotone"
                        dataKey={runner}
                        stroke={colors[index % colors.length]}
                        strokeWidth={selectedRunners.has(runner) ? 3 : 1}
                        opacity={selectedRunners.size === 0 || selectedRunners.has(runner) ? 1 : 0.3}
                        dot={{ r: selectedRunners.has(runner) ? 5 : 3 }}
                        connectNulls // This is good for runners who miss a year
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </>
            ) : (
              <>
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
                  Performance Comparison {selectedYear !== 'all' && `- ${selectedYear}`}
                </h3>
                {selectedYear === 'all' ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', color: '#6b7280', textAlign: 'center' }}>
                    {/* ... (no changes in this section) ... */}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                    {/* CHANGED: BarChart now uses paceInSeconds for dataKey */}
                    <BarChart data={comparisonData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="runner" />
                      {/* CHANGED: YAxis label and formatter for pace */}
                      <YAxis 
                        label={{ value: 'Pace (MM:SS)', angle: -90, position: 'insideLeft' }}
                        tickFormatter={secondsToPace}
                      />
                      {/* CHANGED: Tooltip now shows the original pace string */}
                      <Tooltip 
                        formatter={(value, name, props) => [props.payload.pace, 'Pace']}
                        labelFormatter={(label, payload) => payload?.[0]?.payload.fullName || label}
                      />
                      <Bar dataKey="paceInSeconds" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </>
            )}
          </div>
        </div>

        {/* Improvement Statistics */}
        <div style={{ marginTop: '24px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
            Overall Improvement Statistics
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {improvements.map((stat) => (
              <div key={stat.runner} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h4 style={{ fontWeight: '500' }}>{stat.runner}</h4>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    backgroundColor: stat.isImprovement ? '#dcfce7' : '#fee2e2',
                    color: stat.isImprovement ? '#166534' : '#991b1b'
                  }}>
                    {/* CHANGED: Display the improvement using the secondsToPace formatter */}
                    {stat.isImprovement ? '↓' : '↑'} {secondsToPace(Math.abs(stat.improvement))}
                  </span>
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>
                  {/* CHANGED: Format the first and last pace from seconds */}
                  <p>First: {secondsToPace(stat.firstPace)}</p>
                  <p>Latest: {secondsToPace(stat.lastPace)}</p>
                  <p style={{ color: stat.isImprovement ? '#059669' : '#dc2626' }}>
                    {stat.isImprovement ? 'Improved' : 'Declined'} by {Math.abs(stat.improvementPercent)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;