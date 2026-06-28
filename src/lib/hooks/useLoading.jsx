import { useState, useCallback } from "react";

export function useLoading(initialState = false) {
  const [isLoading, setIsLoading] = useState(initialState);

  const startLoading = useCallback(() => setIsLoading(true), []);
  const stopLoading = useCallback(() => setIsLoading(false), []);

  const withLoading = useCallback(async (asyncFn) => {
    setIsLoading(true);
    try {
      return await asyncFn();
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { isLoading, startLoading, stopLoading, withLoading };
}

export function Spinner({
  size = 40,
  colorClass = "border-t-gray-600",
  label = "Loading...",
}) {
  return (
    <div
      className="inline-flex items-center justify-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className={`rounded-full border-4 border-gray-200 ${colorClass} animate-spin motion-reduce:animate-[spin_2.5s_linear_infinite]`}
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function FullPageSpinner({ label = "Loading..." }) {
  return (
    <div className="flex items-center justify-center w-full h-screen bg-white">
      <Spinner size={48} label={label} />
    </div>
  );
}
