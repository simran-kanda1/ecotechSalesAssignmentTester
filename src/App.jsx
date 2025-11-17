import React, { useState } from 'react';
import './App.css';
import { Clock, MapPin, User, Calendar, CheckCircle, XCircle, Loader, ChevronDown, ChevronUp } from 'lucide-react';

const EcoTechAssignmentTester = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    appointmentDate: '',
    appointmentTime: '10:00'
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const [expandedSalesperson, setExpandedSalesperson] = useState(null);

  // Your Cloud Function URL - replace with actual URL
  const FUNCTION_URL = 'https://us-central1-ecotech-5166a.cloudfunctions.net/assignSalespersonAndBook';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setLogs([]);

    try {
      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          appointmentTime: formData.appointmentTime ? `${formData.appointmentTime}:00` : null
        })
      });

      const data = await response.json();
      setResult(data);
      
      // Parse logs from response if available
      if (data.assignmentDetails) {
        generateLogSummary(data);
      }
    } catch (error) {
      console.error('Error:', error);
      setResult({
        success: false,
        response: 'Error testing assignment. Please check console.',
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const generateLogSummary = (data) => {
    const logEntries = [];
    
    logEntries.push({
      type: 'info',
      message: `Starting assignment process for ${formData.city}`,
      timestamp: new Date().toISOString()
    });

    if (data.assignmentDetails) {
      const details = data.assignmentDetails;
      
      logEntries.push({
        type: 'success',
        message: `Found qualified salesperson: ${data.salesperson}`,
        timestamp: new Date().toISOString()
      });

      if (details.travelTime) {
        logEntries.push({
          type: 'info',
          message: `Travel time from home/office: ${details.travelTime}`,
          timestamp: new Date().toISOString()
        });
      }

      logEntries.push({
        type: 'info',
        message: `Salesperson has ${details.appointmentsOnDate} appointment(s) on requested date`,
        timestamp: new Date().toISOString()
      });

      logEntries.push({
        type: 'info',
        message: `Daily assignments: ${details.todayAssignments}/4`,
        timestamp: new Date().toISOString()
      });

      if (details.scores) {
        logEntries.push({
          type: 'success',
          message: `Final assignment score: ${details.scores.final}`,
          details: {
            performance: (details.scores.performance * 100).toFixed(1) + '%',
            proximity: (parseFloat(details.scores.proximity) * 100).toFixed(1) + '%',
            capacity: (parseFloat(details.scores.capacity) * 100).toFixed(1) + '%',
            routeEfficiency: (parseFloat(details.scores.routeEfficiency) * 100).toFixed(1) + '%'
          },
          timestamp: new Date().toISOString()
        });
      }
    }

    setLogs(logEntries);
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const ScoreBar = ({ label, value, color }) => {
    const percentage = parseFloat(value);
    return (
      <div className="mb-3">
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className="text-sm text-gray-600">{value}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${color}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">EcoTech Assignment Algorithm Tester</h1>
              <p className="text-gray-600">Test salesperson assignment logic with sample leads</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Form */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Lead Information</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="Smith"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="416-555-0123"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="123 Main Street"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="Toronto"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Postal Code
                  </label>
                  <input
                    type="text"
                    name="postalCode"
                    value={formData.postalCode}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="M5H 2N2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Appointment Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="date"
                      name="appointmentDate"
                      value={formData.appointmentDate}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Appointment Time
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="time"
                      name="appointmentTime"
                      value={formData.appointmentTime}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Test Assignment
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Results Panel */}
          <div className="space-y-6">
            {/* Assignment Result */}
            {result && (
              <div className={`rounded-lg shadow-lg p-6 ${result.success ? 'bg-green-50 border-2 border-green-200' : 'bg-red-50 border-2 border-red-200'}`}>
                <div className="flex items-start gap-3 mb-4">
                  {result.success ? (
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                  )}
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {result.success ? 'Assignment Successful' : 'Assignment Failed'}
                    </h3>
                    <p className="text-gray-700">{result.response}</p>
                  </div>
                </div>

                {result.success && result.salesperson && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600">Assigned Salesperson</p>
                        <p className="font-semibold text-gray-900">{result.salesperson}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Salesperson ID</p>
                        <p className="font-semibold text-gray-900">{result.salespersonId}</p>
                      </div>
                    </div>

                    {result.appointmentDate && (
                      <div className="mb-4">
                        <p className="text-sm text-gray-600">Appointment Scheduled</p>
                        <p className="font-semibold text-gray-900">{result.appointmentDate}</p>
                      </div>
                    )}

                    {result.assignmentDetails && result.assignmentDetails.scores && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h4 className="font-semibold text-gray-900 mb-3">Assignment Scores</h4>
                        <ScoreBar 
                          label="Performance Score" 
                          value={result.assignmentDetails.scores.performance} 
                          color="bg-blue-500"
                        />
                        <ScoreBar 
                          label="Proximity Score" 
                          value={result.assignmentDetails.scores.proximity} 
                          color="bg-green-500"
                        />
                        <ScoreBar 
                          label="Capacity Score" 
                          value={result.assignmentDetails.scores.capacity} 
                          color="bg-purple-500"
                        />
                        <ScoreBar 
                          label="Route Efficiency Score" 
                          value={result.assignmentDetails.scores.routeEfficiency} 
                          color="bg-orange-500"
                        />
                        <div className="mt-4 pt-3 border-t border-gray-300">
                          <div className="flex justify-between items-center">
                            <span className="text-base font-bold text-gray-900">Final Score</span>
                            <span className="text-2xl font-bold text-red-600">
                              {result.assignmentDetails.scores.final}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {result.assignmentDetails && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h4 className="font-semibold text-gray-900 mb-2">Additional Details</h4>
                        <div className="space-y-2 text-sm">
                          {result.assignmentDetails.travelTime && (
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-gray-500" />
                              <span className="text-gray-700">
                                Travel Time: <strong>{result.assignmentDetails.travelTime}</strong> from {result.assignmentDetails.travelFrom?.replace('_', ' ')}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            <span className="text-gray-700">
                              Appointments on Date: <strong>{result.assignmentDetails.appointmentsOnDate}/5</strong>
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-500" />
                            <span className="text-gray-700">
                              Today's Assignments: <strong>{result.assignmentDetails.todayAssignments}/4</strong>
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Process Logs */}
            {logs.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Assignment Process</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {logs.map((log, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg ${
                        log.type === 'success' ? 'bg-green-50 border-l-4 border-green-500' :
                        log.type === 'error' ? 'bg-red-50 border-l-4 border-red-500' :
                        'bg-blue-50 border-l-4 border-blue-500'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {log.type === 'success' && <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />}
                        {log.type === 'error' && <XCircle className="w-4 h-4 text-red-600 mt-0.5" />}
                        {log.type === 'info' && <Clock className="w-4 h-4 text-blue-600 mt-0.5" />}
                        <div className="flex-1">
                          <p className="text-sm text-gray-800">{log.message}</p>
                          {log.details && (
                            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                              {Object.entries(log.details).map(([key, value]) => (
                                <div key={key} className="bg-white rounded px-2 py-1">
                                  <span className="text-gray-600 capitalize">{key}: </span>
                                  <span className="font-semibold text-gray-900">{value}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Info Panel */}
            {!result && !loading && (
              <div className="bg-blue-50 rounded-lg shadow-lg p-6 border-2 border-blue-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">How It Works</h3>
                <div className="space-y-2 text-sm text-gray-700">
                  <p className="flex items-start gap-2">
                    <span className="font-semibold text-blue-600">1.</span>
                    <span>System identifies service area based on city</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="font-semibold text-blue-600">2.</span>
                    <span>Checks salesperson availability and capacity</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="font-semibold text-blue-600">3.</span>
                    <span>Calculates travel time and route efficiency</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="font-semibold text-blue-600">4.</span>
                    <span>Scores candidates based on multiple factors</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="font-semibold text-blue-600">5.</span>
                    <span>Assigns best-fit salesperson to the lead</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Configuration Info */}
        <div className="mt-6 bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Algorithm Configuration</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-gray-600 mb-1">Max Travel Time</p>
              <p className="text-xl font-bold text-gray-900">120 min</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-gray-600 mb-1">Max Appointments/Day</p>
              <p className="text-xl font-bold text-gray-900">5</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-gray-600 mb-1">Max New Assignments/Day</p>
              <p className="text-xl font-bold text-gray-900">4</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-gray-600 mb-1">Min Time Gap</p>
              <p className="text-xl font-bold text-gray-900">30 min</p>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-2">Scoring Weights</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-gray-700">Performance: <strong>35%</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-gray-700">Proximity: <strong>30%</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                <span className="text-gray-700">Capacity: <strong>20%</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <span className="text-gray-700">Route Efficiency: <strong>15%</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EcoTechAssignmentTester;