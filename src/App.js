import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import Papa from 'papaparse';
import './App.css';

// Sample data for demo - will be replaced by CSV upload
const sampleRaceData = [
  { runner: 'Alice Johnson', year: 2020, time: 25.5, event: '5K' },
  { runner: 'Alice Johnson', year: 2021, time: 24.8, event: '5K' },
  { runner: 'Alice Johnson', year: 2022, time: 24.2, event: '5K' },
  { runner: 'Alice Johnson', year: 2023, time: 23.9, event: '5K' },
  { runner: 'Alice Johnson', year: 2024, time: 23.4, event: '5K' },
  { runner: 'Bob Smith', year: 2020, time: 28.2, event: '5K' },
  { runner: 'Bob Smith', year: 2021, time: 27.5, event: '5K' },
  { runner: 'Bob Smith', year: 2022, time: 27.1, event: '5K' },
  { runner: 'Bob Smith', year: 2023, time: 26.8, event: '5K' },
  { runner: 'Bob Smith', year: 2024, time: 26.3, event: '5K' },
  { runner: 'Carol Davis', year: 2020, time: 23.1, event: '5K' },
  { runner: 'Carol Davis', year: 2021, time: 22.9, event: '5K' },
  { runner: 'Carol Davis', year: 2022, time: 22.6, event: '5K' },
  { runner: 'Carol Davis', year: 2023, time: 22.3, event: '5K' },
  { runner: 'Carol Davis', year: 2024, time: 22.0, event: '5K' },
];

const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084d0', '#87d068', '#ffb347', '#ff6b6b', '#4ecdc4'];

function App() {
  const [raceData, setRaceData] = useState(sampleRaceData);
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
      dynamicTyping: true,
      complete: (results) => {
        try {
          const cleanedData = results.data
            .filter(row => row.runner && row.year && row.time)
            .map(row => ({
              runner: String(row.runner).trim(),
              year: parseInt(row.year),
              time: parseFloat(row.time),
              event: row.event ? String(row.event).trim() : '5K'
            }))
            .filter(row => !isNaN(row.year) && !isNaN(row.time));

          if (cleanedData.length === 0) {
            setError('No valid data found. Please check your CSV format.');
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
      yearlyData[record.year][record.runner] = record.time;
    });
    return Object.values(yearlyData).sort((a, b) => a.year - b.year);
  }, [raceData]);

  const comparisonData = useMemo(() => {
    if (selectedYear === 'all') return [];
    return raceData
      .filter(d => d.year === parseInt(selectedYear))
      .sort((a, b) => a.time - b.time)
      .map(d => ({
        runner: d.runner.split(' ')[0],
        time: d.time,
        fullName: d.runner
      }));
  }, [selectedYear, raceData]);

  const improvements = useMemo(() => {
    return runners.map(runner => {
      const runnerData = raceData.filter(d => d.runner === runner).sort((a, b) => a.year - b.year);
      if (runnerData.length < 2) return null;
      
      const firstTime = runnerData[0].time;
      const lastTime = runnerData[runnerData.length - 1].time;
      const improvement = firstTime - lastTime;
      const improvementPercent = ((improvement / firstTime) * 100).toFixed(1);
      
      return {
        runner,
        improvement: improvement.toFixed(1),
        improvementPercent,
        firstTime,
        lastTime,
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

  const formatTime = (time) => {
    const minutes = Math.floor(time);
    const seconds = Math.round((time - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

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
            <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
              CSV should have columns: runner, year, time, event
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
              Currently showing: {raceData === sampleRaceData ? 'Sample data' : 'Your uploaded data'} ({raceData.length} records)
            </div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setViewMode('trends')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: viewMode === 'trends' ? '#3b82f6' : '#e5e7eb',
                  color: viewMode === 'trends' ? 'white' : '#374151',
                  cursor: 'pointer'
                }}
              >
                📈 Trends Over Time
              </button>
              <button
                onClick={() => setViewMode('comparison')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: viewMode === 'comparison' ? '#3b82f6' : '#e5e7eb',
                  color: viewMode === 'comparison' ? 'white' : '#374151',
                  cursor: 'pointer'
                }}
              >
                👥 Year Comparison
              </button>
            </div>
            
            {viewMode === 'comparison' && (
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px' }}
              >
                <option value="all">Select Year</option>
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '24px' }}>
          {/* Runner Selection */}
          <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
              🔍 Select Runners
            </h3>
            <div style={{ maxHeight: '384px', overflowY: 'auto' }}>
              {runners.map((runner, index) => (
                <label key={runner} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  cursor: 'pointer', 
                  padding: '8px',
                  borderRadius: '4px',
                  marginBottom: '4px'
                }}>
                  <input
                    type="checkbox"
                    checked={selectedRunners.has(runner)}
                    onChange={() => handleRunnerToggle(runner)}
                    style={{ borderRadius: '4px' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div 
                      style={{ 
                        width: '12px', 
                        height: '12px', 
                        borderRadius: '50%', 
                        backgroundColor: colors[index % colors.length] 
                      }}
                    ></div>
                    <span style={{ fontSize: '14px' }}>{runner}</span>
                  </div>
                </label>
              ))}
            </div>
            <button
              onClick={() => setSelectedRunners(new Set(runners))}
              style={{
                marginTop: '16px',
                width: '100%',
                padding: '8px 12px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Select All
            </button>
            <button
              onClick={() => setSelectedRunners(new Set())}
              style={{
                marginTop: '8px',
                width: '100%',
                padding: '8px 12px',
                backgroundColor: '#d1d5db',
                color: '#374151',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Clear All
            </button>
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
                    <YAxis 
                      label={{ value: 'Time (minutes)', angle: -90, position: 'insideLeft' }}
                      tickFormatter={formatTime}
                    />
                    <Tooltip 
                      formatter={(value) => [formatTime(value), 'Time']}
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
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    height: '400px', 
                    color: '#6b7280',
                    textAlign: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏱️</div>
                      <p>Please select a year to view the comparison</p>
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={comparisonData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="runner" />
                      <YAxis 
                        label={{ value: 'Time (minutes)', angle: -90, position: 'insideLeft' }}
                        tickFormatter={formatTime}
                      />
                      <Tooltip 
                        formatter={(value, name, props) => [formatTime(value), 'Time']}
                        labelFormatter={(label, payload) => {
                          if (payload && payload[0]) {
                            return payload[0].payload.fullName;
                          }
                          return label;
                        }}
                      />
                      <Bar dataKey="time" fill="#8884d8" />
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
                    {stat.isImprovement ? '↓' : '↑'} {Math.abs(stat.improvement)}min
                  </span>
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>
                  <p>First: {formatTime(stat.firstTime)}</p>
                  <p>Latest: {formatTime(stat.lastTime)}</p>
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