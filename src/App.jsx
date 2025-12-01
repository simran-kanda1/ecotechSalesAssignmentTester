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
    performance: 0.35,
    proximity: 0.30,
    capacity: 0.20,
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

    try {
      addLog('info', 'Starting assignment process...');
      addLog('info', `Using algorithm parameters: ${hasParamChanges() ? 'CUSTOM' : 'DEFAULT'}`, algorithmParams);

      // Your Cloud Function URL
      const functionUrl = 'https://us-central1-ecotech-5166a.cloudfunctions.net/assignSalespersonAndBook'; // Replace with actual URL

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

      addLog('success', 'Received response from server');

      // Parse and display detailed results
      if (data.success) {
        addLog('success', `✓ Successfully assigned to ${data.salesperson}`);
        
        if (data.assignmentDetails) {
          const details = data.assignmentDetails;
          
          addLog('info', 'Assignment Analysis:', {
            'Travel Time': details.travelTime,
            'Travel From': details.travelFrom,
            'Appointments on Date': details.appointmentsOnDate,
            'Today\'s Assignments': details.todayAssignments,
            'Final Score': details.scores.final
          });

          addLog('info', 'Score Breakdown:', {
            'Performance': `${details.scores.performance} × ${algorithmParams.weights.performance} = ${(parseFloat(details.scores.performance) * algorithmParams.weights.performance).toFixed(4)}`,
            'Proximity': `${details.scores.proximity} × ${algorithmParams.weights.proximity} = ${(parseFloat(details.scores.proximity) * algorithmParams.weights.proximity).toFixed(4)}`,
            'Capacity': `${details.scores.capacity} × ${algorithmParams.weights.capacity} = ${(parseFloat(details.scores.capacity) * algorithmParams.weights.capacity).toFixed(4)}`,
            'Route Efficiency': `${details.scores.routeEfficiency} × ${algorithmParams.weights.routeEfficiency} = ${(parseFloat(details.scores.routeEfficiency) * algorithmParams.weights.routeEfficiency).toFixed(4)}`
          });
        }

        if (data.allEvaluations) {
          addLog('info', `Evaluated ${data.allEvaluations.length} salespeople total`);
          
          const qualified = data.allEvaluations.filter(e => !e.disqualified);
          const disqualified = data.allEvaluations.filter(e => e.disqualified);
          
          addLog('info', `Qualified: ${qualified.length}, Disqualified: ${disqualified.length}`);
          
          // Show details for each salesperson evaluated
          data.allEvaluations.forEach(evaluation => {
            const name = evaluation.name || evaluation.salesperson?.salesperson || 'Unknown';
            
            if (evaluation.disqualified) {
              addLog('info', `❌ ${name} - Disqualified: ${evaluation.disqualificationReason?.replace(/_/g, ' ')}`);
            } else {
              const score = evaluation.scores?.final?.toFixed(4) || '0.0000';
              const travelTime = evaluation.details?.travelText || 'N/A';
              const appointments = evaluation.details?.appointmentCount || 0;
              
              addLog('info', `✓ ${name} - Score: ${score} (Travel: ${travelTime}, Appointments: ${appointments}/${algorithmParams.maxAppointmentsPerDay})`);
            }
          });
          
          if (disqualified.length > 0) {
            const reasons = {};
            disqualified.forEach(e => {
              const reason = e.disqualificationReason || 'unknown';
              reasons[reason] = (reasons[reason] || 0) + 1;
            });
            addLog('info', 'Disqualification Summary:', reasons);
          }
        }
      } else {
        addLog('error', data.response || 'Assignment failed');
        if (data.reason) {
          addLog('error', `Reason: ${data.reason}`);
        }
      }

      setResult(data);

    } catch (error) {
      console.error('Error:', error);
      addLog('error', `Error: ${error.message}`);
      setResult({
        success: false,
        response: 'An error occurred. Please try again.'
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
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Sales Assignment Algorithm Tester
          </h1>
          <p className="text-gray-600">
            Test the assignment logic and view detailed execution logs
          </p>
        </div>

        {/* Algorithm Parameters Panel */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Algorithm Parameters</h2>
            <button
              onClick={() => setShowParamEditor(!showParamEditor)}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              {showParamEditor ? 'Hide Editor' : 'Edit Parameters'}
            </button>
          </div>

          {showParamEditor && (
            <div className="space-y-6">
              {/* Parameter Changes Summary */}
              {hasParamChanges() && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-blue-900">Active Customizations</h3>
                    <button
                      onClick={resetParams}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Reset to Defaults
                    </button>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(paramChanges).map(([path, values]) => (
                      <div key={path} className="flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-700 capitalize">
                          {path.replace(/([A-Z])/g, ' $1').replace('.', ' → ')}:
                        </span>
                        <span className="text-gray-600">
                          <span className="line-through">{values.original}</span>
                          {' → '}
                          <span className="font-semibold text-blue-600">{values.current}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Time & Capacity Limits */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Time & Capacity Limits</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Travel Time (seconds)
                    </label>
                    <input
                      type="number"
                      value={algorithmParams.maxTravelTimeSeconds}
                      onChange={(e) => handleParamChange('maxTravelTimeSeconds', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Default: {DEFAULT_PARAMS.maxTravelTimeSeconds}s (2 hours)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Appointments Per Day
                    </label>
                    <input
                      type="number"
                      value={algorithmParams.maxAppointmentsPerDay}
                      onChange={(e) => handleParamChange('maxAppointmentsPerDay', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Default: {DEFAULT_PARAMS.maxAppointmentsPerDay}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max New Assignments Per Day
                    </label>
                    <input
                      type="number"
                      value={algorithmParams.maxNewAssignmentsPerDay}
                      onChange={(e) => handleParamChange('maxNewAssignmentsPerDay', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Default: {DEFAULT_PARAMS.maxNewAssignmentsPerDay}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Min Gap Between Appointments (minutes)
                    </label>
                    <input
                      type="number"
                      value={algorithmParams.minGapMinutes}
                      onChange={(e) => handleParamChange('minGapMinutes', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Default: {DEFAULT_PARAMS.minGapMinutes} minutes
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Appointment Duration (minutes)
                    </label>
                    <input
                      type="number"
                      value={algorithmParams.appointmentDurationMinutes}
                      onChange={(e) => handleParamChange('appointmentDurationMinutes', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Default: {DEFAULT_PARAMS.appointmentDurationMinutes} minutes
                    </p>
                  </div>
                </div>
              </div>

              {/* Scoring Weights */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Scoring Weights</h3>
                <p className="text-sm text-gray-600 mb-3">
                  These weights determine how much each factor contributes to the final score. They should sum to 1.0.
                  <span className="font-semibold ml-2">
                    Current sum: {Object.values(algorithmParams.weights).reduce((a, b) => a + b, 0).toFixed(2)}
                  </span>
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Performance Weight
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={algorithmParams.weights.performance}
                      onChange={(e) => handleParamChange('weights.performance', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Default: {DEFAULT_PARAMS.weights.performance} (35%)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Proximity Weight
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={algorithmParams.weights.proximity}
                      onChange={(e) => handleParamChange('weights.proximity', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Default: {DEFAULT_PARAMS.weights.proximity} (30%)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Capacity Weight
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={algorithmParams.weights.capacity}
                      onChange={(e) => handleParamChange('weights.capacity', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Default: {DEFAULT_PARAMS.weights.capacity} (20%)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Route Efficiency Weight
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={algorithmParams.weights.routeEfficiency}
                      onChange={(e) => handleParamChange('weights.routeEfficiency', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Default: {DEFAULT_PARAMS.weights.routeEfficiency} (15%)
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Input Form */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Lead Information</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="firstName">First Name</label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="lastName">Last Name</label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="phone">Phone Number</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="416-555-1234"
                  required
                />
              </div>

              <div>
                <label htmlFor="address">Street Address</label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="123 Main St"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="city">City</label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="Toronto"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="postalCode">Postal Code</label>
                  <input
                    type="text"
                    id="postalCode"
                    name="postalCode"
                    value={formData.postalCode}
                    onChange={handleInputChange}
                    placeholder="M5V 3A8"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="appointmentDate">Appointment Date</label>
                  <input
                    type="date"
                    id="appointmentDate"
                    name="appointmentDate"
                    value={formData.appointmentDate}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div>
                  <label htmlFor="appointmentTime">Appointment Time</label>
                  <input
                    type="time"
                    id="appointmentTime"
                    name="appointmentTime"
                    value={formData.appointmentTime}
                    onChange={handleInputChange}
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

        {/* Results Panel */}
        {result && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Assignment Result</h2>
            
            <div className={`status-badge ${result.success ? 'status-success' : 'status-error'} mb-4`}>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {result.success ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                )}
              </svg>
              {result.success ? 'Assignment Successful' : 'Assignment Failed'}
            </div>

            <div className="space-y-4">
              <p className="text-gray-700">{result.response}</p>

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