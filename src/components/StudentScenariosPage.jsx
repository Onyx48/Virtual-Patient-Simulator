import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../AuthContext.jsx";
import axios from "axios";
import { getAuthHeaders } from "../lib/utils.js";
import ScenarioManagementControlsStudent from "../roles/student/scenarios/ScenarioManagementControlsStudent.jsx";
import ScenrioGridStudent from "../roles/student/scenarios/ScenrioGridStudent.jsx";

function StudentScenariosPage() {
  const { user } = useAuth();
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState("All");

  useEffect(() => {
    const fetchScenarios = async () => {
      try {
        const response = await axios.get("/api/scenarios", getAuthHeaders());
        // Scenarios are already filtered server-side for students
        const mappedScenarios = response.data.map((scenario) => ({
          id: scenario._id,
          scenarioName: scenario.scenarioName,
          description: scenario.description,
          difficulty: scenario.difficulty,
          highestScore: "N/A", // Mock or fetch from results
          status: scenario.status,
        }));
        setScenarios(mappedScenarios);
      } catch (error) {
        console.error("Error fetching scenarios:", error);
      } finally {
        setLoading(false);
      }
    };
    if (user) fetchScenarios();
  }, [user]);

  // Filter and sort scenarios
  const processedScenarios = useMemo(() => {
    let filtered = scenarios;
    if (searchTerm) {
      filtered = filtered.filter(s =>
        s.scenarioName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    // Simple sort logic
    if (sortConfig === "Highest") {
      filtered = [...filtered].sort((a, b) => (b.highestScore || 0) - (a.highestScore || 0));
    } else if (sortConfig === "Lowest") {
      filtered = [...filtered].sort((a, b) => (a.highestScore || 0) - (b.highestScore || 0));
    } else if (sortConfig === "Recent") {
      // Assuming no date, keep as is
    }
    return filtered;
  }, [scenarios, searchTerm, sortConfig]);

  if (loading) return <div className="p-8">Loading scenarios...</div>;

  return (
    <div className="p-8 bg-gray-50 min-h-screen font-sans">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Scenarios</h1>
        <p className="text-gray-600 mt-2">View your assigned scenarios.</p>
      </div>
      <ScenarioManagementControlsStudent
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        sortConfig={sortConfig}
        onSortChange={setSortConfig}
      />
      <ScenrioGridStudent data={processedScenarios} />
    </div>
  );
}

export default StudentScenariosPage;