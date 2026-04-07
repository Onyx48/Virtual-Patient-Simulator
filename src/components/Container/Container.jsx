import React from "react";
import Header from "../Header/Header";
import Sidebar from "../Sidebar/Sidebar";
import ContentArea from "../ContentArea/ContentArea";

function Container() {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <Header />
      <ContentArea />
    </div>
  );
}

export default Container;
