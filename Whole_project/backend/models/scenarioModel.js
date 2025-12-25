import mongoose from 'mongoose';

const scenarioSchema = new mongoose.Schema({
  scenarioName: {
    type: String,
    required: [true, 'Scenario name is required'],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  avgTimeSpent: {
    type: String,
    default: '0 minutes',
  },
  status: {
    type: String,
    enum: ['Draft', 'Published', 'Archived'],
    default: 'Draft',
  },
  permissions: {
    type: String,
    enum: ['Read Only', 'Write Only', 'Both'],
    default: 'Read Only',
  },
  // Add assignedTo for students if needed
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
}, {
  timestamps: true,
});

const Scenario = mongoose.model('Scenario', scenarioSchema);
export default Scenario;