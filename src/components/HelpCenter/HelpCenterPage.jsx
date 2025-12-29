import React from 'react';
import { useAuth } from '../../AuthContext';
import { getHelpContent } from '../../utils/roleContent';

function HelpCenterPage() {
  const { user } = useAuth();
  const role = user?.role || 'guest';
  const content = getHelpContent(role);

  return (
    <div className="p-6">
      <div>
        <h1 className="text-2xl font-bold mb-4">Help & Center</h1>
        <p>Welcome! Here are resources tailored to your role:</p>
        <ul className="list-disc ml-6 mt-2">
          {content.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default HelpCenterPage;