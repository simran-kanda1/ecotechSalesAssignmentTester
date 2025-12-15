import React, { useState, useRef, useEffect } from 'react';
import './App.css';

// Default algorithm parameters (matching your Cloud Function)
const DEFAULT_PARAMS = {
  maxTravelTimeSeconds: 7200,
  maxAppointmentsPerDay: 5,
  maxNewAssignmentsPerDay: 4,
  minGapMinutes: 30,
  appointmentDurationMinutes: 75,
  weights: {
    performance: 0.4,
    proximity: 0.4,
    capacity: 0.05,
    routeEfficiency: 0.15
  }
};

function App() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    appointmentDate: '',
    appointmentTime: ''
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const [showParamEditor, setShowParamEditor] = useState(false);
  const [algorithmParams, setAlgorithmParams] = useState(DEFAULT_PARAMS);
  const [paramChanges, setParamChanges] = useState({});
  const [topCandidates, setTopCandidates] = useState([]);
  
  const logsEndRef = useRef(null);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleParamChange = (path, value) => {
    setAlgorithmParams(prev => {
      const newParams = { ...prev };
      if (path.includes('.')) {
        const [parent, child] = path.split('.');
        newParams[parent] = { ...newParams[parent], [child]: parseFloat(value) };
      } else {
        newParams[path] = parseInt(value);
      }
      return newParams;
    });

    // Track what changed
    setParamChanges(prev => ({
      ...prev,
      [path]: {
        original: getNestedValue(DEFAULT_PARAMS, path),
        current: parseFloat(value) || parseInt(value)
      }
    }));
  };

  const getNestedValue = (obj, path) => {
    if (path.includes('.')) {
      const [parent, child] = path.split('.');
      return obj[parent][child];
    }
    return obj[path];
  };

  const resetParams = () => {
    setAlgorithmParams(DEFAULT_PARAMS);
    setParamChanges({});
  };

  const hasParamChanges = () => {
    return Object.keys(paramChanges).length > 0;
  };

  const addLog = (type, message, details = null) => {
    setLogs(prev => [...prev, {
      type,
      message,
      details,
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setLogs([]);
    setTopCandidates([]);

    try {
      addLog('info', 'Starting assignment process...');
      addLog('info', `Using algorithm parameters: ${hasParamChanges() ? 'CUSTOM' : 'DEFAULT'}`, algorithmParams);

      // Your Cloud Function URL
      const functionUrl = 'https://us-central1-ecotech-5166a.cloudfunctions.net/assignSalespersonAndBook';

      // Check if function URL is configured
      if (functionUrl === 'YOUR_CLOUD_FUNCTION_URL' || !functionUrl || functionUrl.includes('YOUR_')) {
        addLog('error', 'Cloud Function URL not configured!');
        addLog('error', 'Please update the functionUrl variable in App.jsx (line 148)');
        setResult({
          success: false,
          response: 'Configuration Error: Cloud Function URL not set. Please check the console for details.'
        });
        return;
      }

      addLog('info', 'Sending request to assignment function...');

      const requestBody = {
        ...formData,
        algorithmParams: hasParamChanges() ? algorithmParams : undefined
      };

      addLog('info', 'Request data prepared', requestBody);

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        addLog('error', `HTTP Error: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        addLog('error', 'Response body:', errorText.substring(0, 200));
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        addLog('error', 'Invalid response type: Expected JSON but got ' + contentType);
        const errorText = await response.text();
        addLog('error', 'Response preview:', errorText.substring(0, 200));
        throw new Error('Invalid response: Expected JSON but received HTML. Check if the Cloud Function URL is correct.');
      }

      const data = await response.json();

      addLog('success', '✅ Received response from server');
      
      // Log the service area determination
      if (formData.city) {
        addLog('info', `📍 Lead Location: ${formData.city}`);
      }

      // Parse and display detailed results
      if (data.success) {
        addLog('success', `✅ Successfully assigned to ${data.salesperson}`);
        
        if (data.backToBackAssignment) {
          addLog('info', '🎯 BACK-TO-BACK ASSIGNMENT: This lead was scheduled immediately after an existing appointment');
          if (data.adjustedTime) {
            addLog('info', `⏰ Time adjusted to: ${data.adjustedTime} (for optimal routing)`);
          }
        }
        
        if (data.assignmentDetails) {
          const details = data.assignmentDetails;
          
          addLog('info', '📊 Assignment Analysis:');
          addLog('info', `   🚗 Travel Time: ${details.travelTime}`);
          addLog('info', `   📍 Travel From: ${details.travelFrom}`);
          addLog('info', `   📅 Appointments on Date: ${details.appointmentsOnDate}`);
          addLog('info', `   🆕 Today's New Assignments: ${details.todayAssignments}`);
          
          if (details.backToBackConvenience) {
            addLog('info', '   🎯 Back-to-back convenience detected');
          }

          addLog('info', '🎯 Score Breakdown:');
          const perf = parseFloat(details.scores.performance);
          const prox = parseFloat(details.scores.proximity);
          const cap = parseFloat(details.scores.capacity);
          const route = parseFloat(details.scores.routeEfficiency);
          
          addLog('info', `   📈 Performance: ${details.scores.performance} × ${algorithmParams.weights.performance} = ${(perf * algorithmParams.weights.performance).toFixed(4)}`);
          addLog('info', `   📍 Proximity: ${details.scores.proximity} × ${algorithmParams.weights.proximity} = ${(prox * algorithmParams.weights.proximity).toFixed(4)}`);
          addLog('info', `   💼 Capacity: ${details.scores.capacity} × ${algorithmParams.weights.capacity} = ${(cap * algorithmParams.weights.capacity).toFixed(4)}`);
          addLog('info', `   🗺️ Route Efficiency: ${details.scores.routeEfficiency} × ${algorithmParams.weights.routeEfficiency} = ${(route * algorithmParams.weights.routeEfficiency).toFixed(4)}`);
          addLog('success', `   🏆 Final Score: ${details.scores.final}`);
        }

        if (data.allEvaluations) {
          addLog('info', `📊 Evaluated ${data.allEvaluations.length} salespeople total`);
          
          const qualified = data.allEvaluations.filter(e => !e.disqualified);
          const disqualified = data.allEvaluations.filter(e => e.disqualified);
          
          addLog('info', `   ✅ Qualified: ${qualified.length}`);
          addLog('info', `   ❌ Disqualified: ${disqualified.length}`);
          
          if (disqualified.length > 0) {
            const disqualificationReasons = {};
            disqualified.forEach(e => {
              const reason = e.disqualificationReason || 'Unknown';
              const reasonText = reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              disqualificationReasons[reasonText] = (disqualificationReasons[reasonText] || 0) + 1;
            });
            
            addLog('info', '📋 Disqualification reasons:');
            Object.entries(disqualificationReasons).forEach(([reason, count]) => {
              addLog('info', `   • ${reason}: ${count}`);
            });
          }

          // Get top candidates
          const sortedQualified = qualified.sort((a, b) => 
            parseFloat(b.scores.final || 0) - parseFloat(a.scores.final || 0)
          );
          const topN = sortedQualified.slice(0, 5);
          
          if (topN.length > 0) {
            setTopCandidates(topN.map((candidate, index) => ({
              rank: index + 1,
              name: candidate.name,
              userId: candidate.userId,
              finalScore: candidate.scores.final?.toFixed(4) || '0.0000',
              scores: candidate.scores,
              travelTime: candidate.details?.travelText || 'N/A',
              appointmentsOnDate: candidate.details?.appointmentCount || 0,
              todayAssignments: candidate.details?.todayAssignments || 0,
              isChosen: candidate.name === data.salesperson
            })));
            
            addLog('success', `🏆 Top ${topN.length} candidates ranked:`);
            topN.forEach((c, i) => {
              const emoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
              const chosen = c.name === data.salesperson ? ' ✅ CHOSEN' : '';
              addLog('info', `   ${emoji} ${i + 1}. ${c.name} - Score: ${c.scores.final?.toFixed(4) || 'N/A'}${chosen}`);
            });
          }
        }

        setResult({
          success: true,
          salesperson: data.salesperson,
          response: data.response || `Successfully assigned to ${data.salesperson}`,
          assignmentDetails: data.assignmentDetails
        });

      } else {
        // Handle assignment failure
        addLog('error', '❌ No qualified salesperson found');
        
        if (data.reason) {
          const reasonText = data.reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          addLog('info', `📋 Reason: ${reasonText}`);
        }
        
        if (data.allEvaluations) {
          const disqualified = data.allEvaluations.filter(e => e.disqualified);
          const qualified = data.allEvaluations.filter(e => !e.disqualified);
          
          addLog('info', `📊 Evaluated ${data.allEvaluations.length} salespeople total`);
          addLog('info', `   ✅ Qualified: ${qualified.length}`);
          addLog('info', `   ❌ Disqualified: ${disqualified.length}`);
          
          if (disqualified.length > 0) {
            // Group by reason
            const reasons = {};
            disqualified.forEach(e => {
              const reason = e.disqualificationReason || 'unknown';
              if (!reasons[reason]) {
                reasons[reason] = [];
              }
              reasons[reason].push(e.name);
            });
            
            addLog('info', '📋 Disqualification breakdown:');
            Object.entries(reasons).forEach(([reason, names]) => {
              const reasonText = reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              addLog('info', `   • ${reasonText}: ${names.join(', ')}`);
            });
          }
          
          // Show qualified candidates if any exist but weren't chosen
          if (qualified.length > 0) {
            const sortedQualified = qualified.sort((a, b) => 
              parseFloat(b.scores.final || 0) - parseFloat(a.scores.final || 0)
            );
            
            addLog('info', '🏆 Qualified candidates ranked:');
            sortedQualified.slice(0, 5).forEach((c, i) => {
              addLog('info', `   ${i + 1}. ${c.name} - Score: ${c.scores.final?.toFixed(4) || 'N/A'}`);
            });
          }
        }
        
        // Set the result with the proper message from backend
        setResult({
          success: false,
          response: data.response || 'Great, we will have someone from our team reach out to confirm the date and time of the appointment.'
        });
      }

    } catch (error) {
      console.error('Error:', error);
      addLog('error', `❌ Request failed: ${error.message}`);
      setResult({
        success: false,
        response: 'An error occurred while processing the assignment. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const getLogIcon = (type) => {
    switch (type) {
      case 'success':
        return (
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Sales Assignment Algorithm Tester
          </h1>
          <p className="text-gray-600">
            Test the salesperson assignment algorithm with real-time logging and parameter customization
          </p>
        </div>

        {/* Algorithm Configuration */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Algorithm Configuration</h2>
            <button
              onClick={() => setShowParamEditor(!showParamEditor)}
              className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors flex items-center"
            >
              {showParamEditor ? 'Hide' : 'Show'} Parameters
              <svg 
                className={`w-4 h-4 ml-1 transition-transform ${showParamEditor ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Parameter Display */}
          {!showParamEditor && (
            <div className="info-box">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="config-item">
                  <div className="text-xs text-gray-500 mb-1">Max Travel Time</div>
                  <div className="font-semibold text-gray-900">{algorithmParams.maxTravelTimeSeconds / 3600}h</div>
                </div>
                <div className="config-item">
                  <div className="text-xs text-gray-500 mb-1">Max Daily Appts</div>
                  <div className="font-semibold text-gray-900">{algorithmParams.maxAppointmentsPerDay}</div>
                </div>
                <div className="config-item">
                  <div className="text-xs text-gray-500 mb-1">Max New Assigns</div>
                  <div className="font-semibold text-gray-900">{algorithmParams.maxNewAssignmentsPerDay}</div>
                </div>
                <div className="config-item">
                  <div className="text-xs text-gray-500 mb-1">Min Gap</div>
                  <div className="font-semibold text-gray-900">{algorithmParams.minGapMinutes}min</div>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-blue-200">
                <div className="text-xs text-gray-500 mb-2">Score Weights</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="text-sm">
                    <span className="text-gray-600">Performance:</span>{' '}
                    <span className="font-medium">{algorithmParams.weights.performance}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-600">Proximity:</span>{' '}
                    <span className="font-medium">{algorithmParams.weights.proximity}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-600">Capacity:</span>{' '}
                    <span className="font-medium">{algorithmParams.weights.capacity}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-600">Route Eff:</span>{' '}
                    <span className="font-medium">{algorithmParams.weights.routeEfficiency}</span>
                  </div>
                </div>
              </div>

              {hasParamChanges() && (
                <div className="mt-4 pt-4 border-t border-blue-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-600">
                      ⚠ Custom parameters active
                    </span>
                    <button
                      onClick={resetParams}
                      className="text-xs text-gray-600 hover:text-gray-900"
                    >
                      Reset to defaults
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Parameter Editor */}
          {showParamEditor && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Constraint Parameters */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900 text-sm">Constraint Parameters</h3>
                  
                  <div>
                    <label>Max Travel Time (hours)</label>
                    <input
                      type="text"
                      value={algorithmParams.maxTravelTimeSeconds / 3600}
                      onChange={(e) => handleParamChange('maxTravelTimeSeconds', parseFloat(e.target.value) * 3600)}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label>Max Appointments Per Day</label>
                    <input
                      type="text"
                      value={algorithmParams.maxAppointmentsPerDay}
                      onChange={(e) => handleParamChange('maxAppointmentsPerDay', e.target.value)}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label>Max New Assignments Per Day</label>
                    <input
                      type="text"
                      value={algorithmParams.maxNewAssignmentsPerDay}
                      onChange={(e) => handleParamChange('maxNewAssignmentsPerDay', e.target.value)}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label>Min Gap Between Appointments (minutes)</label>
                    <input
                      type="text"
                      value={algorithmParams.minGapMinutes}
                      onChange={(e) => handleParamChange('minGapMinutes', e.target.value)}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label>Appointment Duration (minutes)</label>
                    <input
                      type="text"
                      value={algorithmParams.appointmentDurationMinutes}
                      onChange={(e) => handleParamChange('appointmentDurationMinutes', e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Weight Parameters */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900 text-sm">Score Weights (must sum to 1.0)</h3>
                  
                  <div>
                    <label>Performance Weight</label>
                    <input
                      type="text"
                      value={algorithmParams.weights.performance}
                      onChange={(e) => handleParamChange('weights.performance', e.target.value)}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Weight for conversion rate & success history
                    </p>
                  </div>

                  <div>
                    <label>Proximity Weight</label>
                    <input
                      type="text"
                      value={algorithmParams.weights.proximity}
                      onChange={(e) => handleParamChange('weights.proximity', e.target.value)}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Weight for travel distance/time
                    </p>
                  </div>

                  <div>
                    <label>Capacity Weight</label>
                    <input
                      type="text"
                      value={algorithmParams.weights.capacity}
                      onChange={(e) => handleParamChange('weights.capacity', e.target.value)}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Weight for available appointment slots
                    </p>
                  </div>

                  <div>
                    <label>Route Efficiency Weight</label>
                    <input
                      type="text"
                      value={algorithmParams.weights.routeEfficiency}
                      onChange={(e) => handleParamChange('weights.routeEfficiency', e.target.value)}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Weight for minimizing backtracking
                    </p>
                  </div>

                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Current Sum:</span>
                      <span className={`font-medium ${
                        Math.abs((
                          algorithmParams.weights.performance +
                          algorithmParams.weights.proximity +
                          algorithmParams.weights.capacity +
                          algorithmParams.weights.routeEfficiency
                        ) - 1.0) < 0.01 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {(
                          algorithmParams.weights.performance +
                          algorithmParams.weights.proximity +
                          algorithmParams.weights.capacity +
                          algorithmParams.weights.routeEfficiency
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {hasParamChanges() && (
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg">
                    <span className="text-sm font-medium text-blue-900">
                      Custom parameters will be sent with your request
                    </span>
                    <button
                      onClick={resetParams}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Reset All
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Form */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Lead Information</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label>First Name</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                    placeholder="John"
                  />
                </div>
                <div>
                  <label>Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div>
                <label>Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  required
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <div>
                <label>Street Address</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  required
                  placeholder="123 Main Street"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label>City</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    required
                    placeholder="Toronto"
                  />
                </div>
                <div>
                  <label>Postal Code</label>
                  <input
                    type="text"
                    name="postalCode"
                    value={formData.postalCode}
                    onChange={handleInputChange}
                    required
                    placeholder="M5V 3A8"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label>Appointment Date</label>
                  <input
                    type="date"
                    name="appointmentDate"
                    value={formData.appointmentDate}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div>
                  <label>Appointment Time</label>
                  <input
                    type="time"
                    name="appointmentTime"
                    value={formData.appointmentTime}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </span>
                ) : 'Assign Salesperson'}
              </button>
            </form>
          </div>

          {/* Execution Logs */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Execution Logs</h2>
            
            <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto space-y-3">
              {logs.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No logs yet. Submit the form to see execution details.
                </p>
              ) : (
                logs.map((log, index) => (
                  <div
                    key={index}
                    className={`log-entry ${
                      log.type === 'success' ? 'log-success' :
                      log.type === 'error' ? 'log-error' : 'log-info'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      {getLogIcon(log.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-gray-900">{log.message}</p>
                        <span className="text-xs text-gray-500">{log.timestamp}</span>
                      </div>
                      {log.details && (
                        <div className="mt-2 text-sm text-gray-700 bg-white rounded p-2">
                          <pre className="whitespace-pre-wrap font-mono text-xs">
                            {typeof log.details === 'object' 
                              ? JSON.stringify(log.details, null, 2)
                              : log.details
                            }
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>

        {/* Top 3 Candidates Display */}
        {topCandidates.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Top 3 Candidates</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {topCandidates.map((candidate, index) => (
                <div
                  key={index}
                  className={`candidate-card ${candidate.isChosen ? 'chosen' : ''}`}
                >
                  {/* Rank Badge */}
                  <div className={`candidate-rank-badge rank-${candidate.rank}`}>
                    {candidate.rank}
                  </div>

                  {/* Chosen Badge */}
                  {candidate.isChosen && (
                    <div className="candidate-chosen-badge">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      CHOSEN
                    </div>
                  )}

                  {/* Candidate Name */}
                  <h3 className="candidate-name">{candidate.name}</h3>

                  {/* Final Score Box */}
                  <div className={`candidate-score-box ${candidate.isChosen ? 'chosen' : ''}`}>
                    <div className="candidate-score-label">Final Score</div>
                    <div className="candidate-score-value">
                      {parseFloat(candidate.scores.final).toFixed(4)}
                    </div>
                  </div>

                  {/* Score Metrics */}
                  <div>
                    {/* Performance */}
                    <div className="candidate-metric">
                      <div className="candidate-metric-header">
                        <span className="candidate-metric-label">Performance</span>
                        <span className="candidate-metric-value">
                          {parseFloat(candidate.scores.performance).toFixed(4)}
                        </span>
                      </div>
                      <div className="candidate-bar-container">
                        <div 
                          className="candidate-bar performance"
                          style={{ width: `${Math.min(parseFloat(candidate.scores.performance) * 100, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Proximity */}
                    <div className="candidate-metric">
                      <div className="candidate-metric-header">
                        <span className="candidate-metric-label">Proximity</span>
                        <span className="candidate-metric-value">
                          {parseFloat(candidate.scores.proximity).toFixed(4)}
                        </span>
                      </div>
                      <div className="candidate-bar-container">
                        <div 
                          className="candidate-bar proximity"
                          style={{ width: `${Math.min(parseFloat(candidate.scores.proximity) * 100, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Capacity */}
                    <div className="candidate-metric">
                      <div className="candidate-metric-header">
                        <span className="candidate-metric-label">Capacity</span>
                        <span className="candidate-metric-value">
                          {parseFloat(candidate.scores.capacity).toFixed(4)}
                        </span>
                      </div>
                      <div className="candidate-bar-container">
                        <div 
                          className="candidate-bar capacity"
                          style={{ width: `${Math.min(parseFloat(candidate.scores.capacity) * 100, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Route Efficiency */}
                    <div className="candidate-metric">
                      <div className="candidate-metric-header">
                        <span className="candidate-metric-label">Route Efficiency</span>
                        <span className="candidate-metric-value">
                          {parseFloat(candidate.scores.routeEfficiency).toFixed(4)}
                        </span>
                      </div>
                      <div className="candidate-bar-container">
                        <div 
                          className="candidate-bar route"
                          style={{ width: `${Math.min(parseFloat(candidate.scores.routeEfficiency) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Additional Details */}
                  <div className="candidate-details">
                    <div className="candidate-details-grid">
                      <div className="candidate-detail-box">
                        <div className="candidate-detail-label">Travel Time</div>
                        <div className="candidate-detail-value">{candidate.travelTime}</div>
                      </div>
                      <div className="candidate-detail-box">
                        <div className="candidate-detail-label">Appointments</div>
                        <div className="candidate-detail-value">
                          {candidate.appointmentsOnDate}/{algorithmParams.maxAppointmentsPerDay}
                        </div>
                      </div>
                    </div>
                    <div className="candidate-detail-box">
                      <div className="candidate-detail-label">Today's Assignments</div>
                      <div className="candidate-detail-value">
                        {candidate.todayAssignments}/{algorithmParams.maxNewAssignmentsPerDay}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results Panel */}
        {result && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Assignment Result</h2>
            
            <div className={`status-badge ${result.success ? 'status-success' : 'info-box'} mb-4`}>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {result.success ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                )}
              </svg>
              {result.success ? 'Assignment Successful' : 'Manual Follow-up Required'}
            </div>

            <div className="space-y-4">
              <p className="text-gray-700 text-lg">{result.response}</p>

              {result.success && result.assignmentDetails && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                  <div className="space-y-3">
                    <h3 className="font-semibold text-gray-900">Assignment Details</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Salesperson:</span>
                        <span className="font-medium">{result.salesperson}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Travel Time:</span>
                        <span className="font-medium">{result.assignmentDetails.travelTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">From:</span>
                        <span className="font-medium capitalize">{result.assignmentDetails.travelFrom}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Appointments:</span>
                        <span className="font-medium">{result.assignmentDetails.appointmentsOnDate}/{algorithmParams.maxAppointmentsPerDay}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Today's Assignments:</span>
                        <span className="font-medium">{result.assignmentDetails.todayAssignments}/{algorithmParams.maxNewAssignmentsPerDay}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-semibold text-gray-900">Scoring Breakdown</h3>
                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Performance</span>
                          <span className="font-medium">{result.assignmentDetails.scores.performance}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full" 
                            style={{ width: `${Math.min(parseFloat(result.assignmentDetails.scores.performance) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Proximity</span>
                          <span className="font-medium">{result.assignmentDetails.scores.proximity}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full" 
                            style={{ width: `${Math.min(parseFloat(result.assignmentDetails.scores.proximity) * 100, 100)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Capacity</span>
                          <span className="font-medium">{result.assignmentDetails.scores.capacity}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-purple-500 h-2 rounded-full" 
                            style={{ width: `${Math.min(parseFloat(result.assignmentDetails.scores.capacity) * 100, 100)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Route Efficiency</span>
                          <span className="font-medium">{result.assignmentDetails.scores.routeEfficiency}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-orange-500 h-2 rounded-full" 
                            style={{ width: `${Math.min(parseFloat(result.assignmentDetails.scores.routeEfficiency) * 100, 100)}%` }}
                          />
                        </div>
                      </div>

                      <div className="pt-2 border-t border-gray-200">
                        <div className="flex justify-between font-semibold">
                          <span className="text-gray-900">Final Score</span>
                          <span className="text-gray-900">{result.assignmentDetails.scores.final}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;