import React from 'react';
// import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../../../components/ui/table.jsx';

function EducatorTable({ data, onEditClick, onDeleteClick, onSort, canEdit }) {
  const handleSort = (key) => {
    onSort(key);
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('educatorName')}>
              Educator Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('emailAddress')}>
              Email
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('schoolName')}>
              School
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((educator) => (
            <tr key={educator.id}>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{educator.educatorName}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{educator.emailAddress}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{educator.schoolName}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div className="flex gap-2">
                  {canEdit && onEditClick && (
                    <button
                      onClick={() => onEditClick(educator)}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                    >
                      Edit
                    </button>
                  )}
                  {canEdit && onDeleteClick && (
                    <button
                      onClick={() => onDeleteClick(educator.id)}
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default EducatorTable;