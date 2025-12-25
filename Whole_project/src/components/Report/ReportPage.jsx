import React from 'react';
import { useAuth } from '../../AuthContext';

function ReportPage() {
  const { user } = useAuth();
  const role = user?.role || 'guest';

  const getReportContent = () => {
    switch (role) {
      case 'superadmin':
        return (
          <div>
            <h1 className="text-2xl font-bold mb-4">Superadmin Reports</h1>
            <p>System-wide analytics and reports:</p>
            <ul className="list-disc ml-6 mt-2">
              <li>All schools performance</li>
              <li>User activity across the platform</li>
              <li>Scenario usage statistics</li>
            </ul>
          </div>
        );
      case 'educator':
        return (
          <div>
            <h1 className="text-2xl font-bold mb-4">Educator Reports</h1>
            <p>Reports for your scenarios and students:</p>
            <ul className="list-disc ml-6 mt-2">
              <li>Student progress reports</li>
              <li>Scenario completion rates</li>
              <li>Assignment analytics</li>
            </ul>
          </div>
        );
      case 'student':
        return (
          <div>
            <h1 className="text-2xl font-bold mb-4">Student Reports</h1>
            <p>Your personal progress and achievements:</p>
            <ul className="list-disc ml-6 mt-2">
              <li>Completed scenarios</li>
              <li>Time spent on learning</li>
              <li>Achievement badges</li>
            </ul>
          </div>
        );
      default:
        return (
          <div>
            <h1 className="text-2xl font-bold mb-4">Reports</h1>
            <p>Please log in to view your reports.</p>
          </div>
        );
    }
  };

  return (
    <div className="p-6">
      {getReportContent()}
    </div>
  );
}

export default ReportPage;