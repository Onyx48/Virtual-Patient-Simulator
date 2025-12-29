import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axios from 'axios';

// Async thunks for scenarios
export const fetchScenarios = createAsyncThunk(
  'scenarios/fetchScenarios',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get('/api/scenarios');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || 'Failed to fetch scenarios');
    }
  }
);

export const addScenario = createAsyncThunk(
  'scenarios/addScenario',
  async (scenarioData, { rejectWithValue }) => {
    try {
      const response = await axios.post('/api/scenarios', scenarioData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || 'Failed to add scenario');
    }
  }
);

export const updateScenario = createAsyncThunk(
  'scenarios/updateScenario',
  async ({ id, updates }, { rejectWithValue }) => {
    try {
      const response = await axios.put(`/api/scenarios/${id}`, updates);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || 'Failed to update scenario');
    }
  }
);

export const deleteScenario = createAsyncThunk(
  'scenarios/deleteScenario',
  async (id, { rejectWithValue }) => {
    try {
      await axios.delete(`/api/scenarios/${id}`);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data || 'Failed to delete scenario');
    }
  }
);

const scenarioSlice = createSlice({
  name: 'scenarios',
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
        const index = state.scenarios.findIndex(s => s.id === action.payload.id);
        if (index !== -1) {
          state.scenarios[index] = action.payload;
        }
      })
      .addCase(deleteScenario.fulfilled, (state, action) => {
        state.scenarios = state.scenarios.filter(s => s.id !== action.payload);
      });
  },
});

export const { setSelectedScenario, clearSelectedScenario } = scenarioSlice.actions;
export default scenarioSlice.reducer;