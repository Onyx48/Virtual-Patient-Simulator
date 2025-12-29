import React from "react";
import { ArrowUpIcon, ArrowDownIcon } from "@heroicons/react/20/solid";

const StatCard = ({
  icon,
  label,
  value,
  change,
  changeType,
  iconBgColor = "bg-slate-100",
  iconColor = "text-slate-700",
}) => {
  const isPositive = changeType === "positive";
  const changeColor = isPositive ? "text-green-600" : "text-red-500";
  const ChangeArrow = isPositive ? ArrowUpIcon : ArrowDownIcon;

  return (
    <div className="bg-white p-5 rounded-xl shadow-lg flex-1 min-w-[260px] sm:min-w-[280px]">
      <div className="flex flex-col space-y-3">
        <div className={`p-3 ${iconBgColor} rounded-lg w-fit`}>
          {React.cloneElement(icon, { className: `h-6 w-6 ${iconColor}` })}
        </div>

        <p className="text-sm text-gray-500 font-medium">{label}</p>

        <div className="flex items-end justify-between">
          <p className="text-3xl font-bold text-gray-800">{value}</p>
          {change && (
            <div
              className={`flex items-center text-xs sm:text-sm font-medium ${changeColor}`}
            >
              <span>{change}</span>
              <ChangeArrow className="h-4 w-4 ml-1" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
