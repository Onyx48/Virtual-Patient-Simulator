import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { XMarkIcon, ClockIcon, PlusIcon, MinusIcon } from "@heroicons/react/24/outline";
import { useLanguage } from "../../i18n/LanguageContext";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

function TranscriptViewerModal({ isOpen, onClose, student }) {
  const { language } = useLanguage();
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedScenarios, setExpandedScenarios] = useState({});

  useEffect(() => {
    if (isOpen && student) {
      fetchSessions();
    }
  }, [isOpen, student]);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `/api/sessions/student/${student.id || student._id || student.user_id}`,
        getAuthHeaders()
      );
      setSessions(response.data);
    } catch (error) {
      console.error("Error fetching sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  // Follow the app language, not the browser locale — otherwise a Japanese
  // page shows US-format timestamps.
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const locale = language === "ja" ? "ja-JP" : "en-US";
    return (
      date.toLocaleDateString(locale) +
      " " +
      date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
    );
  };

  const toggleScenario = (scenarioId) => {
    setExpandedScenarios(prev => ({
      ...prev,
      [scenarioId]: !prev[scenarioId]
    }));
  };

  const groupedSessions = useMemo(() => {
    return sessions.reduce((acc, session) => {
      const scenarioId = session.scenario_id?._id || session.scenario_id || "unknown";
      const scenarioName = session.scenario_id?.scenarioName || "Unknown Scenario";
      
      if (!acc[scenarioId]) {
        acc[scenarioId] = {
          name: scenarioName,
          sessions: []
        };
      }
      acc[scenarioId].sessions.push(session);
      return acc;
    }, {});
  }, [sessions]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-center items-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">
              Session Transcripts
            </h3>
            <p className="text-sm text-gray-500 mt-1">{student.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="w-2/5 border-r border-gray-100 overflow-y-auto">
            <div className="p-4">
              <h4 className="text-sm font-medium text-gray-500 mb-3">Sessions</h4>
              {loading ? (
                <p className="text-gray-500 text-sm">Loading sessions...</p>
              ) : sessions.length === 0 ? (
                <p className="text-gray-500 text-sm">No sessions found</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(groupedSessions).map(([scenarioId, group]) => (
                    <div key={scenarioId} className="border border-gray-100 rounded-xl overflow-hidden">
                      <button
                        onClick={() => toggleScenario(scenarioId)}
                        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {expandedScenarios[scenarioId] ? (
                            <MinusIcon className="w-4 h-4 text-gray-600" />
                          ) : (
                            <PlusIcon className="w-4 h-4 text-gray-600" />
                          )}
                          <span className="text-sm font-medium text-gray-900">
                            {group.name}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {group.sessions.length} {group.sessions.length === 1 ? "session" : "sessions"}
                        </span>
                      </button>
                      {expandedScenarios[scenarioId] && (
                        <div className="space-y-1 p-2 bg-white">
                          {group.sessions.map((session) => (
                            <button
                              key={session._id}
                              onClick={() => setSelectedSession(session)}
                              className={`w-full text-left p-2 rounded-lg border transition-all ${
                                selectedSession?._id === session._id
                                  ? "bg-gray-100 border-gray-200"
                                  : "bg-white border-gray-100 hover:bg-gray-50 hover:border-gray-200"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <ClockIcon className="w-3 h-3 text-gray-400" />
                                <span className="text-xs text-gray-500">
                                  {formatDate(session.createdAt)}
                                </span>
                                {session.score > 0 && (
                                  <span className="ml-auto px-1.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded">
                                    {session.score}%
                                  </span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-gray-50">
            {selectedSession ? (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-bold text-gray-900">
                    {selectedSession.scenario_id?.scenarioName || "Session"}
                  </h4>
                  {selectedSession.score > 0 && (
                    <span className="px-3 py-1 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg">
                      Score: {selectedSession.score}%
                    </span>
                  )}
                </div>

                {selectedSession.feedback && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-sm">
                    <span className="font-medium text-gray-900">Feedback: </span>
                    <span className="text-gray-700">{selectedSession.feedback}</span>
                  </div>
                )}

                <div className="bg-white rounded-xl border border-gray-100 p-4">
                  <h5 className="text-sm font-medium text-gray-500 mb-3">Transcript</h5>
                  <div className="space-y-3">
                    {selectedSession.transcription?.map((msg, idx) => (
                      <div key={idx} className="text-xs leading-relaxed">
                        <span
                          className={`font-bold ${
                            msg.role === "user"
                              ? "text-blue-600"
                              : msg.role === "assistant"
                              ? "text-green-600"
                              : "text-purple-600"
                          }`}
                        >
                          {msg.speaker?.trim()
                            ? `${msg.speaker.trim()}:`
                            : msg.role === "user"
                            ? "You:"
                            : msg.role === "assistant"
                            ? "AI:"
                            : "System:"}
                        </span>{" "}
                        <span className="text-gray-600">{msg.content}</span>
                      </div>
                    ))}
                  </div>

                  {(!selectedSession.transcription ||
                    selectedSession.transcription.length === 0) && (
                    <p className="text-gray-500 text-sm">
                      No transcription for this session
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-gray-500 text-sm">
                  Select a session to view transcription
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TranscriptViewerModal;