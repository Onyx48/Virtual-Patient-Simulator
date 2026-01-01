import React from 'react';
// import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../../../components/ui/table.jsx';

function StudentTable({ data, onEditClick, onDeleteClick, onViewTranscriptClick, onViewProfileClick, onSort, canEdit }) {
  const handleSort = (key) => {
    onSort(key);
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('studentName')}>
              Student Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('emailAddress')}>
              Email
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Assigned Scenarios
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((student) => {
            console.log("Student assignedScenarios:", student.assignedScenarios);
            return (
            <tr key={student.id}>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{student.studentName}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.emailAddress}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.schoolName}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.assignedScenarios?.length || 0}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div className="flex gap-2">
                  {canEdit && onEditClick && (
                    <button
                      onClick={() => onEditClick(student)}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                    >
                      Edit
                    </button>
                  )}
                  {canEdit && onDeleteClick && (
                    <button
                      onClick={() => onDeleteClick(student.id)}
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
                    >
                      Delete
                    </button>
                  )}
                  {onViewTranscriptClick && (
                    <button
                      onClick={() => onViewTranscriptClick(student)}
                      className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
                    >
                      Transcript
                    </button>
                  )}
                  {onViewProfileClick && (
                    <button
                      onClick={() => onViewProfileClick(student)}
                      className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
                    >
                      Profile
                    </button>
                  )}
                </div>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default StudentTable;