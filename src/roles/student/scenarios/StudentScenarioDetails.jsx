import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { ChevronLeft, Bell, MessageSquare } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";
import { getAuthHeaders } from "../../../lib/utils.js";
import {
  fetchSessionsByStudentAndScenario,
  fetchScenario,
} from "../../../redux/slices/sessionSlice.js";

function StudentScenarioDetails({ onBack }) {
  const navigate = useNavigate();
  const { id: scenarioId } = useParams();
  const dispatch = useDispatch();
  const [activeAttempt, setActiveAttempt] = useState(1);
  const [showAllTurns, setShowAllTurns] = useState(false);

  const { sessions, scenarioData, totalCount, hasMore, loading } = useSelector(
    (state) => state.sessions
  );

  useEffect(() => {
    const storedUser = localStorage.getItem("currentUser");
    const studentId = storedUser ? JSON.parse(storedUser)._id : null;

    if (scenarioId) {
      if (!scenarioData) {
        dispatch(fetchScenario(scenarioId));
      }

      if (!sessions || sessions.length === 0) {
        if (studentId) {
          dispatch(
            fetchSessionsByStudentAndScenario({ studentId, scenarioId, page: 1 })
          );
        }
      } else if (sessions.length > 0 && sessions[0]?.scenario_id !== scenarioId) {
        dispatch(
          fetchSessionsByStudentAndScenario({ studentId, scenarioId, page: 1 })
        );
      }
    }
  }, [scenarioId, dispatch]);

  const currentSession = useMemo(() => {
    if (sessions.length === 0) return null;
    const sortedSessions = [...sessions].sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );
    return sortedSessions[activeAttempt - 1] || sortedSessions[0];
  }, [sessions, activeAttempt]);

  const attemptsData = useMemo(() => {
    if (sessions.length === 0) return [];
    return sessions
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .map((s) => s.score);
  }, [sessions]);

  const results = useMemo(() => {
    if (sessions.length === 0)
      return { lowest: "0%", average: "0%", highest: "0%" };
    const scores = sessions.map((s) => s.score);
    const lowest = Math.min(...scores);
    const highest = Math.max(...scores);
    const average = Math.round(
      scores.reduce((a, b) => a + b, 0) / scores.length
    );
    return {
      lowest: `${lowest}%`,
      average: `${average}%`,
      highest: `${highest}%`,
    };
  }, [sessions]);

  const currentScore = currentSession?.score ?? 0;
  const currentFeedback = currentSession?.feedback ?? "";
  const totalAttempts = totalCount || sessions.length || 0;

  const handleStartSession = async () => {
    if (!scenarioId) {
      toast.error("Scenario ID is missing.");
      return;
    }

    try {
      const response = await axios.post(
        "/api/sessions/start",
        { scenario_id: scenarioId },
        getAuthHeaders()
      );
      const redirectUrl = response.data?.redirect_url;
      if (!redirectUrl) {
        throw new Error("Redirect URL missing in response");
      }
      window.open(redirectUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Error starting session:", error);
      const message =
        error?.response?.data?.message || "Failed to start session.";
      toast.error(message);
    }
  };

  const renderTranscript = () => {
    if (!currentSession || !currentSession.transcription) {
      return <p className="text-gray-500">No transcript available</p>;
    }

    const turns = currentSession.transcription.filter(
      (t) => t.role !== "system",
    );

    return (
      <div className="space-y-4">
        {(showAllTurns ? turns : turns.slice(0, 10)).map((item, idx) => (
            <p key={idx} className="text-xs leading-relaxed text-gray-600">
              {/*
                The speaker's own name ("h", "John Smith") when the transcript
                carried one, falling back to the role for older rows that have
                no speaker field.
              */}
              <span className="font-bold text-gray-900">
                {item.speaker?.trim()
                  ? `${item.speaker.trim()}:`
                  : item.role === "user"
                    ? "User:"
                    : "Assistant:"}
              </span>{" "}
            {item.content}
          </p>
        ))}
        {turns.length > 10 && (
          <button
            onClick={() => setShowAllTurns((shown) => !shown)}
            className="text-[#F59E0B] font-bold hover:underline mt-2"
          >
            {showAllTurns
              ? "− Show Less"
              : `+ Load More (${turns.length - 10} more)`}
          </button>
        )}
      </div>
    );
  };

  if (loading && sessions.length === 0 && !scenarioData) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] p-6 font-sans">
        <div className="max-w-5xl mx-auto flex items-center justify-between mb-8">
          <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">
            Individual Scenario
          </h1>
        </div>
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="bg-white rounded-2xl p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] p-6 font-sans">
        <div className="max-w-5xl mx-auto flex items-center justify-between mb-8">
          <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">
            Individual Scenario
          </h1>
          <div className="flex gap-4 text-gray-400">
            <Bell className="w-5 h-5 cursor-pointer hover:text-gray-600 transition-colors" />
            <MessageSquare className="w-5 h-5 cursor-pointer hover:text-gray-600 transition-colors" />
          </div>
        </div>

        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex justify-between items-center mb-2">
            <button
              onClick={() => (onBack ? onBack() : navigate(-1))}
              className="flex items-center px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Go Back
            </button>
            <button
              onClick={handleStartSession}
              className="px-6 py-2.5 bg-[#F59E0B] hover:bg-amber-600 text-white text-sm font-bold rounded-lg shadow-md transition-colors"
            >
              Start Session
            </button>
          </div>

          <div className="bg-white rounded-2xl p-12 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100 text-center">
            <h2 className="text-lg font-semibold text-gray-700 mb-2">
              No sessions available yet
            </h2>
            <p className="text-gray-500">
              Start a session to begin practicing.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] p-6 font-sans">
      <div className="max-w-5xl mx-auto flex items-center justify-between mb-8">
        <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">
          Individual Scenario
        </h1>
        <div className="flex gap-4 text-gray-400">
          <Bell className="w-5 h-5 cursor-pointer hover:text-gray-600 transition-colors" />
          <MessageSquare className="w-5 h-5 cursor-pointer hover:text-gray-600 transition-colors" />
        </div>
      </div>

      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex justify-between items-center mb-2">
          <button
            onClick={() => (onBack ? onBack() : navigate(-1))}
            className="flex items-center px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Go Back
          </button>
          <button
            onClick={handleStartSession}
            className="px-6 py-2.5 bg-[#F59E0B] hover:bg-amber-600 text-white text-sm font-bold rounded-lg shadow-md transition-colors"
          >
            Start Session
          </button>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
            <h3 className="text-sm font-bold text-gray-900">
              Scenario Feedback
            </h3>
            {sessions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {sessions.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveAttempt(idx + 1)}
                    className={`px-4 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${
                      activeAttempt === idx + 1
                        ? "bg-black text-white border-black"
                        : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    Attempt {idx + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
          {currentFeedback ? (
            <p className="text-xs text-gray-500 leading-relaxed">
              {currentFeedback}
            </p>
          ) : (
            <p className="text-xs text-gray-500 leading-relaxed">
              No feedback available for this session.
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {scenarioData?.name || "Scenario"}
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                {scenarioData?.description || ""}
              </p>
            </div>
            <span className="text-[10px] font-bold text-gray-400">
              ID: {scenarioData?.id || scenarioId}
            </span>
          </div>

          <div className="flex items-center gap-16 pt-6 border-t border-gray-50">
            <div>
              <span className="block text-[10px] text-gray-400 font-bold uppercase mb-2">
                Difficulty
              </span>
              <div className="flex items-center gap-2">
                <div className="flex items-end gap-[2px] h-3">
                  <div className="w-1 h-1.5 bg-[#F59E0B] rounded-sm"></div>
                  <div className="w-1 h-2.5 bg-[#F59E0B] rounded-sm"></div>
                  <div className="w-1 h-3.5 bg-gray-200 rounded-sm"></div>
                </div>
                <span className="text-xs font-bold text-[#F59E0B]">
                  {scenarioData?.difficulty || "Medium"}
                </span>
              </div>
            </div>
            <div>
              <span className="block text-[10px] text-gray-400 font-bold uppercase mb-2">
                Score
              </span>
              <span className="text-sm font-bold text-gray-900">
                {currentScore || 0}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-gray-400 font-bold uppercase mb-2">
                Total Attempts
              </span>
              <span className="text-sm font-bold text-gray-900">
                {totalAttempts}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 mb-8">
            Scenario Attempts
          </h3>

          <div className="h-48 w-full flex items-end justify-between px-2 gap-4">
            {attemptsData.map((score, index) => (
              <div
                key={index}
                className="flex flex-col items-center flex-1 group cursor-pointer h-full justify-end"
              >
                <div className="relative w-full max-w-[20px] bg-gray-50 rounded-t-full h-full flex items-end overflow-hidden">
                  <div
                    style={{ height: `${score}%` }}
                    className="w-full bg-[#10B981] rounded-t-full transition-all duration-500 group-hover:bg-[#059669]"
                  ></div>
                </div>
                <span className="text-[10px] text-gray-400 mt-3 font-medium">
                  Attempt {index + 1}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 mb-6">Results</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#FFF1F2] py-4 rounded-xl text-center">
              <span className="text-xs font-bold text-red-500">
                Lowest Score: {results.lowest}
              </span>
            </div>
            <div className="bg-[#FFF7ED] py-4 rounded-xl text-center">
              <span className="text-xs font-bold text-orange-500">
                Average Score: {results.average}
              </span>
            </div>
            <div className="bg-[#ECFDF5] py-4 rounded-xl text-center">
              <span className="text-xs font-bold text-[#10B981]">
                Highest Score: {results.highest}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-gray-900">Transcript</h3>
            {sessions.length > 0 && (
              <div className="flex gap-2">
                {sessions.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveAttempt(idx + 1)}
                    className={`text-[10px] px-3 py-1 border rounded-md font-bold transition-colors ${
                      activeAttempt === idx + 1
                        ? "bg-black text-white border-black"
                        : "text-gray-500 border-gray-200 bg-white"
                    }`}
                  >
                    Attempt {idx + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
          {renderTranscript()}
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100 mb-10">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Feedback</h3>
          {currentFeedback ? (
            <p className="text-xs text-gray-500 leading-relaxed">
              {currentFeedback}
            </p>
          ) : (
            <p className="text-gray-500 text-xs">
              No feedback for this session.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default StudentScenarioDetails;
