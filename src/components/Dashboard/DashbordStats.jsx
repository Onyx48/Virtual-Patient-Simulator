import React from "react";
import StatCard from "./StatCard";
import {
  BuildingOffice2Icon,
  BookOpenIcon,
  UserGroupIcon as EducatorsIcon,
} from "@heroicons/react/24/outline";

function DashboardStats({ stats }) {
  // CORRECTED: Only 3 cards as per your screenshot
  const statConfig = [
    {
      id: 1,
      key: "activeSchools",
      label: "Active Schools",
      icon: <BuildingOffice2Icon />,
      iconBgColor: "bg-blue-100",
      iconColor: "text-blue-600",
    },
    {
      id: 2,
      key: "activeScenarios",
      label: "Active Scenarios",
      icon: <BookOpenIcon />,
      iconBgColor: "bg-purple-100",
      iconColor: "text-purple-600",
    },
    {
      id: 3,
      key: "activeEducators",
      label: "Active Educators",
      icon: <EducatorsIcon />,
      iconBgColor: "bg-green-100",
      iconColor: "text-green-600",
    },
  ];

  return (
    <div className="flex flex-wrap md:flex-nowrap gap-4 sm:gap-6 justify-start mb-6">
      {statConfig.map((item) => {
        // If value is 0, display 0. If undefined, default to 0.
        const value =
          stats && stats[item.key] !== undefined ? stats[item.key] : 0;

        return (
          <StatCard
            key={item.id}
            icon={item.icon}
            label={item.label}
            value={value}
            change={null}
            changeType="neutral"
            iconBgColor={item.iconBgColor}
            iconColor={item.iconColor}
          />
        );
      })}
    </div>
  );
}

export default DashboardStats;
