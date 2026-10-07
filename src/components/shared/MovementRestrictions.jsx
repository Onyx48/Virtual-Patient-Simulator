import React, { useMemo, useState } from "react";
import { useController } from "react-hook-form";
import { ChevronDown, Search, X, RotateCcw } from "lucide-react";

/*
 * Animation-trigger picker for the scenario form.
 *
 * Built for a long catalogue (hundreds of movements across many regions), on
 * the observation that almost every movement in a case is normal: the educator
 * only cares about the handful that are restricted. So the restrictions are
 * what is summarised up top, regions stay collapsed unless they hold one, and a
 * search box reaches any movement without scrolling through the rest.
 *
 * Bound to the form's `movements` field, shape { [regionId]: { [movementId]:
 * value } }. An unset movement is shown as Full but stays unset, exactly as
 * before — formatMovementsForBackend omits it, so saved data is unchanged.
 */

// "External_Rotation" -> "External rotation"
const humanize = (label) =>
  label
    .split("_")
    .map((word, i) => (i === 0 ? word : word.toLowerCase()))
    .join(" ");

// "Full" -> "Full", "Ltd" -> "Limited", "90_Ltd" -> "Limited 90°"
const optionLabel = (opt) => {
  if (opt === "Full") return "Full";
  if (opt === "Ltd") return "Limited";
  const graded = opt.match(/^(\d+)_Ltd$/);
  return graded ? `Limited ${graded[1]}°` : humanize(opt);
};

const isRestricted = (value) => !!value && value !== "Full";

function SegmentedControl({ options, value, onChange, name }) {
  const current = value || "Full";
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5"
    >
      {options.map((opt) => {
        const active = current === opt;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt)}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              active
                ? opt === "Full"
                  ? "bg-white text-gray-800 shadow-sm"
                  : "bg-orange-500 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {optionLabel(opt)}
          </button>
        );
      })}
    </div>
  );
}

function MovementRestrictions({ control, regions }) {
  const {
    field: { value: movements = {}, onChange },
  } = useController({ name: "movements", control });

  const [query, setQuery] = useState("");
  const [restrictedOnly, setRestrictedOnly] = useState(false);
  // Regions the user has explicitly opened or closed; anything absent falls
  // back to "open if it holds a restriction".
  const [openState, setOpenState] = useState({});

  const setMovement = (regionId, movementId, next) =>
    onChange({
      ...movements,
      [regionId]: { ...(movements[regionId] || {}), [movementId]: next },
    });

  const clearMovement = (regionId, movementId) => {
    const region = { ...(movements[regionId] || {}) };
    delete region[movementId];
    onChange({ ...movements, [regionId]: region });
  };

  const resetRegion = (regionId) => onChange({ ...movements, [regionId]: {} });

  const restrictions = useMemo(
    () =>
      regions.flatMap((region) =>
        region.movements
          .filter((m) => isRestricted(movements[region.id]?.[m.id]))
          .map((m) => ({
            region,
            movement: m,
            value: movements[region.id][m.id],
          })),
      ),
    [regions, movements],
  );

  const q = query.trim().toLowerCase();
  const visibleRegions = regions
    .map((region) => {
      const regionMatches = q && region.label.toLowerCase().includes(q);
      const items = region.movements.filter((m) => {
        if (restrictedOnly && !isRestricted(movements[region.id]?.[m.id]))
          return false;
        if (!q || regionMatches) return true;
        return humanize(m.label).toLowerCase().includes(q);
      });
      const count = region.movements.filter((m) =>
        isRestricted(movements[region.id]?.[m.id]),
      ).length;
      return { region, items, count };
    })
    .filter(({ items }) => items.length > 0);

  // While searching or filtering, every matching region is shown open.
  const isOpen = (regionId, count) =>
    q || restrictedOnly ? true : (openState[regionId] ?? count > 0);

  return (
    <div className="rounded-lg border border-gray-200">
      {/* Header: title, the rule of the section, and the active restrictions. */}
      <div className="p-4 border-b border-gray-100 space-y-3">
        <div>
          <h3 className="text-sm font-bold text-gray-800">
            Movement restrictions
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Every movement is full range unless you limit it here. Select these
            yourself — the AI does not fill them in.
          </p>
        </div>

        {restrictions.length === 0 ? (
          <p className="text-xs text-gray-400 italic">
            All movements full range
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {restrictions.map(({ region, movement, value }) => (
              <span
                key={`${region.id}-${movement.id}`}
                className="inline-flex items-center gap-1 rounded-full bg-orange-50 border border-orange-200 pl-2.5 pr-1 py-0.5 text-xs text-orange-800"
              >
                <span className="font-semibold">{region.label}</span>
                <span className="text-orange-400">·</span>
                {humanize(movement.label)}
                <span className="text-orange-400">·</span>
                {optionLabel(value)}
                <button
                  type="button"
                  onClick={() => clearMovement(region.id, movement.id)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-orange-100"
                  aria-label={`Remove ${region.label} ${humanize(movement.label)} restriction`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search movements or regions..."
              className="w-full border border-gray-300 pl-8 pr-8 py-2 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={restrictedOnly}
              onChange={(e) => setRestrictedOnly(e.target.checked)}
              className="w-3.5 h-3.5 accent-orange-500"
            />
            Restricted only
          </label>
        </div>
      </div>

      {/* One collapsible row per region. */}
      <div className="divide-y divide-gray-100">
        {visibleRegions.length === 0 && (
          <p className="p-4 text-xs text-gray-400 text-center">
            {restrictedOnly && !q
              ? "No restrictions set."
              : "No movements match your search."}
          </p>
        )}
        {visibleRegions.map(({ region, items, count }) => {
          const open = isOpen(region.id, count);
          return (
            <div key={region.id}>
              <div className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50">
                <button
                  type="button"
                  onClick={() =>
                    setOpenState((s) => ({ ...s, [region.id]: !open }))
                  }
                  className="flex items-center gap-2 flex-1 text-left"
                  aria-expanded={open}
                >
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 transition-transform ${open ? "" : "-rotate-90"}`}
                  />
                  <span className="text-sm font-semibold text-gray-800">
                    {region.label}
                  </span>
                  <span className="text-xs text-gray-400">
                    {region.movements.length}
                  </span>
                  {count > 0 && (
                    <span className="rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5">
                      {count} limited
                    </span>
                  )}
                </button>
                {count > 0 && (
                  <button
                    type="button"
                    onClick={() => resetRegion(region.id)}
                    className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                )}
              </div>

              {open && (
                <ul className="px-4 pb-3 grid grid-cols-1 lg:grid-cols-2 gap-x-6">
                  {items.map((movement) => {
                    const value = movements[region.id]?.[movement.id];
                    return (
                      <li
                        key={movement.id}
                        className={`flex items-center justify-between gap-3 py-1.5 pl-6 ${
                          isRestricted(value) ? "" : "text-gray-600"
                        }`}
                      >
                        <span
                          className={`text-sm ${isRestricted(value) ? "font-semibold text-gray-900" : ""}`}
                        >
                          {humanize(movement.label)}
                        </span>
                        <SegmentedControl
                          name={`${region.label} ${humanize(movement.label)}`}
                          options={movement.options}
                          value={value}
                          onChange={(next) =>
                            setMovement(region.id, movement.id, next)
                          }
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MovementRestrictions;
