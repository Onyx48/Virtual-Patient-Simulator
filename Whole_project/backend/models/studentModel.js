// WHOLE_PROJECT/models/studentModel.js
import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema({
  user: { // Link to the User model document (_id)
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
    unique: true, // Each student profile is linked to one unique user
  },
  grade: {
    type: String,
  },
  school: { // Example field
    type: String,
  },
  enrollmentDate: {
    type: Date,
    default: Date.now,
  },
  // Add other student-specific fields here (e.g., subjects, guardianInfo)
}, { timestamps: true });

const Student = mongoose.model('Student', studentSchema);

export default Student;