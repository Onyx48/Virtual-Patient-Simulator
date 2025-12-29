// WHOLE_PROJECT/models/schoolModel.js
import mongoose from 'mongoose';

const schoolSchema = new mongoose.Schema({
  schoolName: {
    type: String,
    required: [true, 'School Name is required'],
    trim: true,
    unique: true // School names should probably be unique
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  email: {
    type: String,
    required: [true, 'Email address is required'],
    unique: true, // School emails should probably be unique
    lowercase: true,
    trim: true,
    match: [/.+\@.+\..+/, 'Please fill a valid email address'],
  },
  subscription: { // e.g., "Subscription (1 Year)"
    type: String,
    enum: ['Subscription (1 Year)', 'Subscription (6 Months)', 'Expired'], // Add other options as needed
    default: 'Subscription (1 Year)'
  },
  subscriptionType: { // e.g., "Premium"
    type: String,
    enum: ['Premium', 'Basic', 'Free'], // Add other options
    default: 'Premium'
  },
  startDate: { // Stored as Date for proper sorting/filtering in DB
    type: Date,
    required: [true, 'Start Date is required']
  },
  expireDate: { // Stored as Date
    type: Date,
    required: [true, 'Expire Date is required']
  },
  status: {
    type: String,
    enum: ['Active', 'Expired', 'Pending'], // Add other statuses
    default: 'Active'
  },
  permissions: {
    type: String,
    enum: ['Read Only', 'Write Only', 'Both'],
    default: 'Read Only'
  },
  timeSpent: { // If this is a numerical value, change to Number
    type: String, // Keeping as string to match your JSON "10h"
    default: '0h'
  },
  // You might want to link schools to specific admins/users later
  // createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // assignedEducators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, {
  timestamps: true, // Adds createdAt and updatedAt
  collection: 'schools' // Mongoose will pluralize anyway, but explicit
});

// Custom validation (Example: End Date must be after Start Date)
schoolSchema.path('expireDate').validate(function(value) {
  if (!this.startDate || !value) return true; // Don't validate if dates are missing
  return value >= this.startDate;
}, 'End Date must be on or after Start Date.');

const School = mongoose.model('School', schoolSchema);
export default School;