import React, { Suspense } from "react";
import Header from "../Header/Header";
import Sidebar from "../Sidebar/Sidebar";
import ContentArea from "../ContentArea/ContentArea";
import { FullPageSpinner } from "../../lib/hooks/useLoading";

function Container() {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <Header />
      <Suspense fallback={<FullPageSpinner />}>
        <ContentArea />
      </Suspense>
    </div>
  );
}

export default Container;
