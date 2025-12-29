import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

// Async thunk for fetching dashboard data
export const fetchDashboardData = createAsyncThunk(
  "dashboard/fetchDashboardData",
  async (_, { rejectWithValue }) => {
    try {
      const [statsResponse, schoolsResponse] = await Promise.all([
        axios.get("/api/dashboard/stats"),
        axios.get("/api/dashboard/schools-detailed"), // Updated to fetch detailed data
      ]);
      return {
        stats: statsResponse.data,
        schools: schoolsResponse.data,
      };
    } catch (error) {
      return rejectWithValue(
        error.response?.data || "Failed to fetch dashboard data"
      );
    }
  }
);

const dashboardSlice = createSlice({
  name: "dashboard",
  initialState: {
    stats: {
      activeSchools: 0,
      activeScenarios: 0,
      activeEducators: 0,
      activeStudents: 0,
    },
    schools: [], // This will now contain { name, students, educators, activeScenarios }
    loading: false,
    error: null,
  },
  reducers: {
    updateStats: (state, action) => {
      state.stats = { ...state.stats, ...action.payload };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboardData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDashboardData.fulfilled, (state, action) => {
        state.loading = false;
        state.stats = action.payload.stats;
        state.schools = action.payload.schools;
      })
      .addCase(fetchDashboardData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { updateStats } = dashboardSlice.actions;
export default dashboardSlice.reducer;
