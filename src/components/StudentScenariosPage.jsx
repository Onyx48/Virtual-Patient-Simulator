import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../AuthContext.jsx";
import axios from "axios";
import { getAuthHeaders } from "../lib/utils.js";
import ScenarioManagementControlsStudent from "../roles/student/scenarios/ScenarioManagementControlsStudent.jsx";
import ScenrioGridStudent from "../roles/student/scenarios/ScenrioGridStudent.jsx";
import PaginationBar from "./ui/PaginationBar";
import { usePagination } from "../lib/hooks/usePagination";
import { useLoading, Spinner } from "../lib/hooks/useLoading";
import toast from "react-hot-toast";

function StudentScenariosPage() {
  const { user } = useAuth();
  const [scenarios, setScenarios] = useState([]);
  const { isLoading, withLoading } = useLoading(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState("All");

  useEffect(() => {
    const fetchScenarios = async () => {
      await withLoading(async () => {
        const response = await axios.get("/api/scenarios", getAuthHeaders());
        const mappedScenarios = response.data.map((scenario) => ({
          id: scenario._id,
          scenarioName: scenario.scenarioName,
          description: scenario.description,
          difficulty: scenario.difficulty,
          highestScore: "N/A",
          status: scenario.status,
        }));
        setScenarios(mappedScenarios);
      });
    };
    if (user) fetchScenarios();
  }, [user]);

  const handleStartNow = async (scenarioId) => {
    try {
      const response = await axios.post(
        "/api/sessions/start",
        { scenario_id: scenarioId },
        getAuthHeaders(),
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

  const processedScenarios = useMemo(() => {
    let filtered = scenarios;
    if (searchTerm) {
      filtered = filtered.filter(
        (s) =>
          s.scenarioName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.description.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }
    if (sortConfig === "Highest") {
      filtered = [...filtered].sort(
        (a, b) => (b.highestScore || 0) - (a.highestScore || 0),
      );
    } else if (sortConfig === "Lowest") {
      filtered = [...filtered].sort(
        (a, b) => (a.highestScore || 0) - (b.highestScore || 0),
      );
    } else if (sortConfig === "Recent") {
    }
    return filtered;
  }, [scenarios, searchTerm, sortConfig]);

  const {
    paginatedData,
    currentPage,
    totalPages,
    totalItems,
    pageNumbers,
    handlePageChange,
    nextPage,
    prevPage,
    isFirstPage,
    isLastPage,
    rangeStart,
    rangeEnd,
    resetPage,
  } = usePagination(processedScenarios, 8);

  useEffect(() => {
    resetPage();
  }, [searchTerm, sortConfig]);

  if (isLoading) return <div className="p-8 flex justify-center"><Spinner size={40} /></div>;

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
      <ScenrioGridStudent
        data={paginatedData}
        onStartNow={handleStartNow}
      />
      <PaginationBar
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        pageNumbers={pageNumbers}
        onPageChange={handlePageChange}
        onPrevPage={prevPage}
        onNextPage={nextPage}
        isFirstPage={isFirstPage}
        isLastPage={isLastPage}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
      />
    </div>
  );
}

export default StudentScenariosPage;
