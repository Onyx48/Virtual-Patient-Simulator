import React from 'react';
import { useAuth } from '../../AuthContext';

function HelpCenterPage() {
  const { user } = useAuth();
  const role = user?.role || 'guest';

  const getHelpContent = () => {
    switch (role) {
      case 'superadmin':
        return (
          <div>
            <h1 className="text-2xl font-bold mb-4">Superadmin Help & Center</h1>
            <p>Welcome, Superadmin! Here are resources for managing the entire system:</p>
            <ul className="list-disc ml-6 mt-2">
              <li>How to manage schools</li>
              <li>System-wide reports</li>
              <li>User role management</li>
            </ul>
          </div>
        );
      case 'educator':
        return (
          <div>
            <h1 className="text-2xl font-bold mb-4">Educator Help & Center</h1>
            <p>Welcome, Educator! Here are resources for managing scenarios and students:</p>
            <ul className="list-disc ml-6 mt-2">
              <li>How to create and edit scenarios</li>
              <li>Assigning scenarios to students</li>
              <li>Viewing student progress</li>
            </ul>
          </div>
        );
      case 'student':
        return (
          <div>
            <h1 className="text-2xl font-bold mb-4">Student Help & Center</h1>
            <p>Welcome, Student! Here are resources for your learning journey:</p>
            <ul className="list-disc ml-6 mt-2">
              <li>How to access and complete scenarios</li>
              <li>Viewing your progress</li>
              <li>Contacting your educator</li>
            </ul>
          </div>
        );
      default:
        return (
          <div>
            <h1 className="text-2xl font-bold mb-4">Help & Center</h1>
            <p>Please log in to access role-specific help resources.</p>
          </div>
        );
    }
  };

  return (
    <div className="p-6">
      {getHelpContent()}
    </div>
  );
}

export default HelpCenterPage;