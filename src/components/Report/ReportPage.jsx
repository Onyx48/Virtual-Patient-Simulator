import React from 'react';
import { useAuth } from '../../AuthContext';
import { getReportContent } from '../../utils/roleContent';

function ReportPage() {
  const { user } = useAuth();
  const role = user?.role || 'guest';
  const content = getReportContent(role);

  return (
    <div className="p-6">
      <div>
        <h1 className="text-2xl font-bold mb-4">Reports</h1>
        <p>Access your personalized reports and analytics:</p>
        <ul className="list-disc ml-6 mt-2">
          {content.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default ReportPage;