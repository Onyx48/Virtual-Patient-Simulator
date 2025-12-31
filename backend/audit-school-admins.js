import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/userModel.js';

dotenv.config();

const auditSchoolAdmins = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to database');

    const schoolAdminsWithoutSchoolId = await User.find({ role: 'school_admin', schoolId: { $exists: false } });
    const schoolAdminsWithNullSchoolId = await User.find({ role: 'school_admin', schoolId: null });

    console.log('School admins without schoolId field:', schoolAdminsWithoutSchoolId.length);
    schoolAdminsWithoutSchoolId.forEach(admin => console.log(`- ${admin.name} (${admin.email})`));

    console.log('School admins with null schoolId:', schoolAdminsWithNullSchoolId.length);
    schoolAdminsWithNullSchoolId.forEach(admin => console.log(`- ${admin.name} (${admin.email})`));

    await mongoose.disconnect();
    console.log('Disconnected from database');
  } catch (error) {
    console.error('Error:', error);
  }
};

auditSchoolAdmins();