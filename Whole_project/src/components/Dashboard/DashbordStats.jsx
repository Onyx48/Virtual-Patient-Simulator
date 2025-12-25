import React from "react";
import StatCard from "./StatCard";
import {
  BuildingOffice2Icon,
  BookOpenIcon,
  UserGroupIcon as EducatorsIcon,
} from "@heroicons/react/24/outline";

function DashbordStats({ stats: dynamicStats }) {
  const defaultStats = [
    {
      id: 10,
      icon: <BuildingOffice2Icon />,
      label: "Active Schools",
      value: "55",
      change: "+7.50%",
      changeType: "postive",
      iconBgColor: "bg-slate-100",
      iconColor: "text-slate-600",
    },
    {
      id: 11,
      icon: <BookOpenIcon />,
      label: "Active Scenarios",
      value: "2,200",
      change: "-5.4%",
      changeType: "negative",
      iconBgColor: "bg-slate-100",
      iconColor: "text-slate-600",
    },
    {
      id: 12   ,
      icon: <EducatorsIcon />,
      label: "Active Educators",
      value: "80",
      change: "+2.68%",
      changeType: "postive",
      iconBgColor: "bg-slate-100",
      iconColor: "text-slate-600",
    },
  ];

  const stats = dynamicStats ? [
    {
      ...defaultStats[0],
      value: dynamicStats.activeSchools || defaultStats[0].value,
    },
    {
      ...defaultStats[1],
      value: dynamicStats.activeScenarios || defaultStats[1].value,
    },
    {
      ...defaultStats[2],
      value: dynamicStats.activeEducators || defaultStats[2].value,
    },
  ] : defaultStats;

  return(
  <div className="flex flex-wrap md:flex-nowrap gap-4 sm:gap-6 justify-start mb-6">
    {stats.map((stat) => (
      <StatCard
        key={stat.id}
        icon={stat.icon}
        label={stat.label}
        value={stat.value}
        change={stat.change}
        chnageType={stat.changeType}
        iconBgColor={stat.iconBgColor}
        iconColor={stat.iconColor}
      />
    ))}
  </div>
  )
}

export default DashbordStats;
