import { createContext, useContext } from "react";
const ReferenceAreaRegistrationContext = createContext(null);
function useReferenceAreaRegistration() {
  return useContext(ReferenceAreaRegistrationContext);
}
export {
  ReferenceAreaRegistrationContext,
  useReferenceAreaRegistration
};
