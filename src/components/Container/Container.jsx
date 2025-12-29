// src/components/Container/Container.jsx
import React from "react";
import Header from "../Header/Header";
import Sidebar from "../Sidebar/Sidebar";
import ContentArea from "../ContentArea/ContentArea"; // Ensure this path is correct

function Container() {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar /> {/* Sidebar is fixed left */}
      <Header />  {/* Header is fixed top, positioned right of sidebar */}
      <ContentArea /> {/* ContentArea fills the remaining space */}
    </div>
  );
}

export default Container;