import { useEffect, useState } from "react";
function useEnterComplete(mountProgress) {
  const [complete, setComplete] = useState(() => mountProgress.get() >= 1);
  useEffect(() => {
    if (mountProgress.get() >= 1) {
      setComplete(true);
      return;
    }
    return mountProgress.on("change", (value) => {
      if (value >= 1) {
        setComplete(true);
      }
    });
  }, [mountProgress]);
  return complete;
}
export {
  useEnterComplete
};
