import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { getAuthHeaders } from "../../lib/utils.js";

export const fetchSessionsByStudentAndScenario = createAsyncThunk(
  "sessions/fetchByStudentAndScenario",
  async ({ studentId, scenarioId, page = 1 }, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `/api/sessions/by-student/${studentId}/${scenarioId}?page=${page}`,
        getAuthHeaders()
      );
      return { ...response.data, page };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch sessions"
      );
    }
  }
);

export const fetchScenario = createAsyncThunk(
  "sessions/fetchScenario",
  async (scenarioId, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `/api/scenarios/${scenarioId}`,
        getAuthHeaders()
      );
      return {
        id: response.data._id,
        name: response.data.scenarioName,
        description: response.data.description,
        difficulty: response.data.difficulty || "Medium",
      };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch scenario"
      );
    }
  }
);

const sessionSlice = createSlice({
  name: "sessions",
  initialState: {
    sessions: [],
    scenarioData: null,
    totalCount: 0,
    hasMore: false,
    currentPage: 1,
    loading: false,
    scenarioLoading: false,
    error: null,
  },
  reducers: {
    clearSessions: (state) => {
      state.sessions = [];
      state.scenarioData = null;
      state.totalCount = 0;
      state.hasMore = false;
      state.currentPage = 1;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSessionsByStudentAndScenario.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSessionsByStudentAndScenario.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.page === 1) {
          state.sessions = action.payload.sessions;
        } else {
          state.sessions = [...state.sessions, ...action.payload.sessions];
        }
        state.totalCount = action.payload.totalCount;
        state.hasMore = action.payload.hasMore;
        state.currentPage = action.payload.currentPage;
      })
      .addCase(fetchSessionsByStudentAndScenario.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchScenario.pending, (state) => {
        state.scenarioLoading = true;
      })
      .addCase(fetchScenario.fulfilled, (state, action) => {
        state.scenarioLoading = false;
        state.scenarioData = action.payload;
      })
      .addCase(fetchScenario.rejected, (state, action) => {
        state.scenarioLoading = false;
        state.error = action.payload;
      });
  },
});

export const { clearSessions } = sessionSlice.actions;
export default sessionSlice.reducer;
