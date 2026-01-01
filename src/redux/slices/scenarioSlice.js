import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { getAuthHeaders } from "../../lib/utils.js";

// Async thunks for scenarios
export const fetchScenarios = createAsyncThunk(
  "scenarios/fetchScenarios",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get("/api/scenarios", getAuthHeaders());
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data || "Failed to fetch scenarios"
      );
    }
  }
);

export const addScenario = createAsyncThunk(
  "scenarios/addScenario",
  async (scenarioData, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        "/api/scenarios",
        scenarioData,
        getAuthHeaders()
      );
      // RETURN ONLY THE SCENARIO OBJECT
      return response.data.scenario;
    } catch (error) {
      return rejectWithValue(error.response?.data || "Failed to add scenario");
    }
  }
);

export const updateScenario = createAsyncThunk(
  "scenarios/updateScenario",
  async ({ id, updates }, { rejectWithValue }) => {
    try {
      const response = await axios.put(
        `/api/scenarios/${id}`,
        updates,
        getAuthHeaders()
      );
      // RETURN ONLY THE SCENARIO OBJECT
      return response.data.scenario;
    } catch (error) {
      return rejectWithValue(
        error.response?.data || "Failed to update scenario"
      );
    }
  }
);

export const deleteScenario = createAsyncThunk(
  "scenarios/deleteScenario",
  async (id, { rejectWithValue }) => {
    try {
      await axios.delete(`/api/scenarios/${id}`, getAuthHeaders());
      return id;
    } catch (error) {
      return rejectWithValue(
        error.response?.data || "Failed to delete scenario"
      );
    }
  }
);

export const assignScenarios = createAsyncThunk(
  "scenarios/assignScenarios",
  async (assignmentPayload, { dispatch, rejectWithValue }) => {
    try {
      const promises = [];

      assignmentPayload.forEach((change) => {
        // Update scenario with IDs
        promises.push(
          axios.put(
            `/api/scenarios/${change.scenarioId}`,
            { assignedTo: change.assignedToIds },
            getAuthHeaders()
          )
        );

        // Update students
        change.studentUpdates.forEach((update) => {
          const updateData = {};
          if (update.addScenarios.length > 0) {
            updateData.$addToSet = { assignedScenarios: { $each: update.addScenarios } };
          }
          if (update.removeScenarios.length > 0) {
            updateData.$pull = { assignedScenarios: { $in: update.removeScenarios } };
          }
          if (Object.keys(updateData).length > 0) {
            promises.push(
              axios.put(
                `/api/students/${update.studentId}`,
                updateData,
                getAuthHeaders()
              )
            );
          }
        });
      });

       await Promise.all(promises);

       // Update Redux state immediately with the new assignments
       // Note: We can't easily populate user objects here without additional API calls,
       // so we'll rely on the fetchScenarios() call to get populated data

       // Also dispatch fetchScenarios as backup to ensure populated data
       dispatch(fetchScenarios());

       // Dispatch custom event to notify student components to refetch
       if (typeof window !== 'undefined') {
         window.dispatchEvent(new CustomEvent('scenarioAssignmentsChanged'));
       }

       // Also dispatch fetchScenarios to ensure Redux state is up to date
       dispatch(fetchScenarios());

       return { message: "Assignments updated successfully" };
    } catch (error) {
      console.error("Assign scenarios error:", error.response?.data || error.message);
      return rejectWithValue(error.response?.data || "Failed to update assignments");
    }
  }
);

const scenarioSlice = createSlice({
  name: "scenarios",
  initialState: {
    scenarios: [],
    selectedScenario: null,
    loading: false,
    error: null,
  },
  reducers: {
    setSelectedScenario: (state, action) => {
      state.selectedScenario = action.payload;
    },
    clearSelectedScenario: (state) => {
      state.selectedScenario = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchScenarios.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchScenarios.fulfilled, (state, action) => {
        state.loading = false;
        state.scenarios = action.payload;
      })
      .addCase(fetchScenarios.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(addScenario.fulfilled, (state, action) => {
        state.scenarios.push(action.payload);
      })
      .addCase(updateScenario.fulfilled, (state, action) => {
        const index = state.scenarios.findIndex(
          (s) => s._id === action.payload._id || s.id === action.payload._id
        );
        if (index !== -1) {
          state.scenarios[index] = action.payload;
        }
      })
      .addCase(deleteScenario.fulfilled, (state, action) => {
        state.scenarios = state.scenarios.filter(
          (s) => (s._id || s.id) !== action.payload
        );
      });
  },
});

export const { setSelectedScenario, clearSelectedScenario } =
  scenarioSlice.actions;
export default scenarioSlice.reducer;
