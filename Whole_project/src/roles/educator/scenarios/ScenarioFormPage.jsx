import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { addScenario, updateScenario } from '../../../redux/slices/scenarioSlice.js';

function ScenarioFormPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const selectedScenario = useSelector((state) => state.scenarios.selectedScenario);

  const isEdit = !!id;
  const title = isEdit ? "Edit Scenario" : "Add New Scenario";

  const [scenarioData, setScenarioData] = useState({
    scenarioName: "",
    description: "",
    creator: "",
    avgTimeSpent: "",
    status: "Draft",
    permissions: "Read Only",
  });

  const [modalOpen, setModalOpen] = useState(null);
  const [tempValue, setTempValue] = useState("");

  useEffect(() => {
    if (isEdit && selectedScenario) {
      setScenarioData(selectedScenario);
    }
  }, [isEdit, selectedScenario]);

  const handleFieldClick = (field) => {
    setTempValue(scenarioData[field]);
    setModalOpen(field);
  };

  const handleModalSave = () => {
    setScenarioData({ ...scenarioData, [modalOpen]: tempValue });
    setModalOpen(null);
  };

  const handleModalCancel = () => {
    setModalOpen(null);
  };

  const handleSaveScenario = () => {
    if (isEdit) {
      dispatch(updateScenario({ id, updates: scenarioData }));
    } else {
      const newScenario = {
        ...scenarioData,
        id: Date.now() + Math.random(),
      };
      dispatch(addScenario(newScenario));
    }
    navigate('/scenarios');
  };

  const handleCancel = () => {
    navigate('/scenarios');
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">{title}</h1>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Scenario Name</label>
          <button
            onClick={() => handleFieldClick('scenarioName')}
            className="w-full p-2 border border-gray-300 rounded-md text-left"
          >
            {scenarioData.scenarioName || "Click to edit"}
          </button>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <button
            onClick={() => handleFieldClick('description')}
            className="w-full p-2 border border-gray-300 rounded-md text-left"
          >
            {scenarioData.description || "Click to edit"}
          </button>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Creator</label>
          <button
            onClick={() => handleFieldClick('creator')}
            className="w-full p-2 border border-gray-300 rounded-md text-left"
          >
            {scenarioData.creator || "Click to edit"}
          </button>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Avg. Time Spent</label>
          <button
            onClick={() => handleFieldClick('avgTimeSpent')}
            className="w-full p-2 border border-gray-300 rounded-md text-left"
          >
            {scenarioData.avgTimeSpent || "Click to edit"}
          </button>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Status</label>
          <select
            value={scenarioData.status}
            onChange={(e) => setScenarioData({ ...scenarioData, status: e.target.value })}
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="Draft">Draft</option>
            <option value="Published">Published</option>
            <option value="Archived">Archived</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Permissions</label>
          <select
            value={scenarioData.permissions}
            onChange={(e) => setScenarioData({ ...scenarioData, permissions: e.target.value })}
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="Read Only">Read Only</option>
            <option value="Write Only">Write Only</option>
            <option value="Both">Both</option>
          </select>
        </div>
      </div>
      <div className="mt-4 space-x-2">
        <button onClick={handleSaveScenario} className="px-4 py-2 bg-blue-500 text-white rounded">
          {isEdit ? "Save Changes" : "Save Scenario"}
        </button>
        <button onClick={handleCancel} className="px-4 py-2 bg-gray-500 text-white rounded">
          Cancel
        </button>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-4 rounded shadow-lg">
            <h2 className="text-lg font-bold mb-2">Edit {modalOpen}</h2>
            {modalOpen === 'description' ? (
              <textarea
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded"
                rows="4"
              />
            ) : (
              <input
                type="text"
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded"
              />
            )}
            <div className="mt-2 space-x-2">
              <button onClick={handleModalSave} className="px-4 py-2 bg-green-500 text-white rounded">
                Save
              </button>
              <button onClick={handleModalCancel} className="px-4 py-2 bg-red-500 text-white rounded">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ScenarioFormPage;