// WHOLE_PROJECT/routes/studentRoutes.js
import express from 'express';
import Student from '../models/studentModel.js';
import User from '../models/userModel.js'; // To populate user details
import { protect } from '../middleware/authMiddleware.js';
import { checkAccess } from '../middleware/roleAccessMiddleware.js';

const router = express.Router();

// GET /api/students - Get all student profiles (with user details)
// @access Private (Educator, School Admin, Superadmin)
router.get('/', protect, checkAccess('viewStudents'), async (req, res) => {
  try {
    let query = {};
    // Apply scope filtering
    if (req.scope.educatorId) {
      query.educatorId = req.scope.educatorId; // Educator sees only their students
    }
    // For school_admin, would need to filter by educators in their school (complex, add later)

    // Populate user details (name, email) from the referenced User document
    const students = await Student.find(query).populate('user', 'name email role');
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/students/:id - Get a single student's profile by their Student Profile _id
// @access Private (Educator, School Admin, Superadmin, Student for own)
router.get('/:id', protect, checkAccess('viewStudents'), async (req, res) => {
  try {
    const studentProfile = await Student.findById(req.params.id)
                                .populate('user', 'name email role');
    if (!studentProfile) {
      return res.status(404).json({ message: 'Student profile not found' });
    }
    res.json(studentProfile);
  } catch (err) {
    if (err.kind === 'ObjectId') {
        return res.status(404).json({ message: 'Student profile not found (invalid ID format)' });
    }
    res.status(500).json({ message: err.message });
  }
});

// GET /api/students/user/:userId - Get a student's profile using their User _id
// Useful for a logged-in student to fetch their own profile details
// @access Private (Educator, School Admin, Superadmin, Student for own)
router.get('/user/:userId', protect, checkAccess('viewStudents'), async (req, res) => {
    try {
        const studentProfile = await Student.findOne({ user: req.params.userId })
                                    .populate('user', 'name email role');
        if (!studentProfile) {
        return res.status(404).json({ message: 'Student profile not found for this user.' });
        }
        res.json(studentProfile);
    } catch (err) {
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ message: 'Student profile not found (invalid user ID format)' });
        }
        res.status(500).json({ message: err.message });
    }
});

// PUT /api/students/:id - Update a student's profile data (e.g., grade, school) by Student Profile _id
// @access Private (Educator, School Admin, Superadmin)
router.put('/:id', protect, checkAccess('manageStudents'), async (req, res) => {
  const { grade, school, enrollmentDate /* other updatable fields */ } = req.body;
  try {
    const studentProfile = await Student.findById(req.params.id);

    if (!studentProfile) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    // Update only provided fields
    if (grade !== undefined) studentProfile.grade = grade;
    if (school !== undefined) studentProfile.school = school;
    if (enrollmentDate !== undefined) studentProfile.enrollmentDate = enrollmentDate;
    // ... update other fields

    const updatedStudentProfile = await studentProfile.save();
    // Populate user details for the response
    const populatedProfile = await Student.findById(updatedStudentProfile._id)
                                      .populate('user', 'name email role');
    res.json(populatedProfile);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/students/:id - Delete a student's profile (and their User account) by Student Profile _id
// @access Private (Educator, School Admin, Superadmin)
router.delete('/:id', protect, checkAccess('manageStudents'), async (req, res) => {
  try {
    const studentProfile = await Student.findById(req.params.id);
    if (!studentProfile) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    // Also delete the associated User account to keep data consistent
    await User.findByIdAndDelete(studentProfile.user);
    await Student.findByIdAndDelete(req.params.id); // Delete the student profile itself

    res.json({ message: 'Student profile and associated user account removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;