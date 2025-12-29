import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Bell, MessageSquare } from "lucide-react";

// --- MOCK DATA (Matches your Screenshot) ---
const MOCK_DETAILS = {
  id: "VS123456",
  name: "Pediatric Asthma Case",
  description: "Manage a young asthma patient.",
  fullDescription:
    "Lorem ipsum dolor sit amet consectetur. Interdum eget sem id rhoncus neque sit... Pretium sed id netus morbi. Tellus nam nisl id cursus pretium nullam consequat vitae sem... Aliquam a quisque habitant senectus eu... Sagittis ultrices eget aliquam ultrices eleifend dui.",
  difficulty: "Medium",
  currentScore: 66,
  totalAttempts: 7,
  // This array represents the height % of the bars in the chart
  attemptsData: [20, 35, 55, 85, 68, 55, 88],
  results: {
    lowest: "50%",
    average: "75%",
    highest: "90%",
  },
};

function StudentScenarioDetails({ onBack }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const [activeAttempt, setActiveAttempt] = useState(1);

  // Use mock data for UI visualization
  const data = MOCK_DETAILS;

  return (
    <div className="min-h-screen bg-[#F9FAFB] p-6 font-sans">
      {/* Top Header */}
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
        {/* Navigation & Start Button */}
        <div className="flex justify-between items-center mb-2">
           <button
             onClick={() => onBack ? onBack() : navigate(-1)}
             className="flex items-center px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
           >
            <ChevronLeft className="w-4 h-4 mr-1" /> Go Back
          </button>
          <button className="px-6 py-2.5 bg-[#F59E0B] hover:bg-amber-600 text-white text-sm font-bold rounded-lg shadow-md transition-colors">
            Start Scenario
          </button>
        </div>

        {/* 1. Feedback / Description Card */}
        <div className="bg-white rounded-2xl p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
            <h3 className="text-sm font-bold text-gray-900">
              Scenario Feedback
            </h3>
            {/* Attempt Tabs */}
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4].map((num) => (
                <button
                  key={num}
                  onClick={() => setActiveAttempt(num)}
                  className={`px-4 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${
                    activeAttempt === num
                      ? "bg-black text-white border-black"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  Attempt {num}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            {data.fullDescription}{" "}
            <span className="text-[#F59E0B] font-bold cursor-pointer hover:underline ml-1">
              See More
            </span>
          </p>
        </div>

        {/* 2. Info Card (ID, Difficulty, Score) */}
        <div className="bg-white rounded-2xl p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{data.name}</h2>
              <p className="text-xs text-gray-500 mt-1">{data.description}</p>
            </div>
            <span className="text-[10px] font-bold text-gray-400">
              ID: {data.id}
            </span>
          </div>

          <div className="flex items-center gap-16 pt-6 border-t border-gray-50">
            {/* Difficulty */}
            <div>
              <span className="block text-[10px] text-gray-400 font-bold uppercase mb-2">
                Difficulty
              </span>
              <div className="flex items-center gap-2">
                {/* Difficulty Bars */}
                <div className="flex items-end gap-[2px] h-3">
                  <div className="w-1 h-1.5 bg-[#F59E0B] rounded-sm"></div>
                  <div className="w-1 h-2.5 bg-[#F59E0B] rounded-sm"></div>
                  <div className="w-1 h-3.5 bg-gray-200 rounded-sm"></div>
                </div>
                <span className="text-xs font-bold text-[#F59E0B]">
                  {data.difficulty}
                </span>
              </div>
            </div>
            {/* Score */}
            <div>
              <span className="block text-[10px] text-gray-400 font-bold uppercase mb-2">
                Score
              </span>
              <span className="text-sm font-bold text-gray-900">
                {data.currentScore}
              </span>
            </div>
            {/* Attempts */}
            <div>
              <span className="block text-[10px] text-gray-400 font-bold uppercase mb-2">
                Total Attempts
              </span>
              <span className="text-sm font-bold text-gray-900">
                {data.totalAttempts}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Attempts Chart */}
        <div className="bg-white rounded-2xl p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 mb-8">
            Scenario Attempts
          </h3>

          <div className="h-48 w-full flex items-end justify-between px-2 gap-4">
            {/* Bars */}
            {data.attemptsData.map((score, index) => (
              <div
                key={index}
                className="flex flex-col items-center flex-1 group cursor-pointer h-full justify-end"
              >
                <div className="relative w-full max-w-[20px] bg-gray-50 rounded-t-full h-full flex items-end overflow-hidden">
                  {/* The Green Bar */}
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

        {/* 4. Results Summary */}
        <div className="bg-white rounded-2xl p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 mb-6">Results</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#FFF1F2] py-4 rounded-xl text-center">
              <span className="text-xs font-bold text-red-500">
                Lowest Score: {data.results.lowest}
              </span>
            </div>
            <div className="bg-[#FFF7ED] py-4 rounded-xl text-center">
              <span className="text-xs font-bold text-orange-500">
                Average Score: {data.results.average}
              </span>
            </div>
            <div className="bg-[#ECFDF5] py-4 rounded-xl text-center">
              <span className="text-xs font-bold text-[#10B981]">
                Highest Score: {data.results.highest}
              </span>
            </div>
          </div>
        </div>

        {/* 5. Transcript */}
        <div className="bg-white rounded-2xl p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-gray-900">Transcript</h3>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((num) => (
                <button
                  key={num}
                  className={`text-[10px] px-3 py-1 border rounded-md font-bold transition-colors ${
                    num === 1
                      ? "bg-black text-white border-black"
                      : "text-gray-500 border-gray-200 bg-white"
                  }`}
                >
                  Attempt {num}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6 text-xs leading-relaxed text-gray-600">
            <p>
              <span className="font-bold text-gray-900">Assistant:</span> Kayla:
              Good morning, olaf. Thank you for seeing me. I'm here to provide
              guidance in your Clinical Reasoning for the 55-year-old office
              administrator with hand pain and stiffness. Let's start by
              discussing your impression of this patient and why you think so.
            </p>
            <p>
              <span className="font-bold text-gray-900">User:</span> olaf:
              Clearly the patient had, um uh...persistent hand pain and
              stiffness, um, which hampered not just daily activities, but also
              work. Um, so we need to look at a solution to at least make it
              possible in the short term to pick up her normal activities again.
            </p>
            <button className="text-[#F59E0B] font-bold hover:underline mt-2">
              + Load More
            </button>
          </div>
        </div>

        {/* 6. Footer Feedback */}
        <div className="bg-white rounded-2xl p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100 mb-10">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Feedback</h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            Lorem ipsum dolor sit amet consectetur. Interdum eget sem id rhoncus
            neque sit... Pretium sed id netus morbi. Tellus nam nisl id cursus
            pretium nullam consequat vitae sem... Aliquam a quisque habitant
            senectus eu... Sagittis ultrices eget aliquam ultrices eleifend dui.{" "}
            <span className="text-[#F59E0B] font-bold cursor-pointer hover:underline ml-1">
              See More
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default StudentScenarioDetails;
