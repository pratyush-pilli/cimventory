// src/App.tsx
import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import axios from "axios";
axios.defaults.withCredentials = true;

import HomePage from "./Components/Home/home";
import RequisitionForm from "./Components/Indent/requisition_form";
import EditRequisition from "./Components/Indent/Edit/edit_requisition";
import ApprovalTable from "./Components/Approval/approval";
import Login from "./Components/Login/login";
import PrivateRoute from "./Components/Login/PrivateRoute";
import MasterSheet from "./Components/Master/master";
import Layout from "./layout";
import VendorRegistration from "./Components/Vendor/VendorRegistration";
import VendorDataGrid from "./Components/Vendor/VendorData";
import InwardForm from "./Components/Store/Inward/inward";
import InventoryForm from "./Components/Store/Inventory/inventory";
import POFilter from "./Components/Master/po/POFilter";
import Allocate from "./Components/Store/Allocate/Allocate";
import OutwardStock from "./Components/Store/Outward/outward";
import ItemGenerator from "./Components/Items/ItemGenerator";
import ItemMasterDataGrid from "./Components/Items/ItemDatabase/itemData";
import RequisitionVerification from "./Components/Store/Verification/Verification";
import POApproval from "./Components/PurchaseOrder/Approval/POApproval";
import EditPO from "./Components/PurchaseOrder/Approval/po_edit";
import VendorApproval from "./Components/Vendor/VendorApproval";
import VendorEditForm from "./Components/Vendor/VendorEditForm";
import ItemApproval from "./Components/Items/ItemApproval";
import ItemSubmitter from "./Components/Items/ItemSubmitter";
import roleBasedAccess from "./config/roleConfig";

import {
  UnsavedChangesProvider,
  useUnsavedChanges,
} from "./contexts/UnsavedChangesContext";
import POLineItems from "./Components/Master/po/POLineItems";
import POPreviewPrint from "./Components/Master/POPreviewPrint";
import GatePassList from "./Components/Store/GatePass/GatePassList";
import ReturnableGatePass from "./Components/Store/GatePass/ReturnableGatePass";
import RejectedMaterialDetail from "./Components/Store/Rejected/RejectedMaterialDetail";
import RejectedMaterialList from "./Components/Store/Rejected/RejectedMaterialList";
import ClientReturnForm from "./Components/Store/Rejected/ClientReturnForm";
import RejectedMaterialManager from "./Components/Store/Rejected/RejectedMaterialManager";
import InvoiceTracker from "./Components/Store/InvoiceTracker/InvoiceTracker";
import AdminDashboard from "./Components/Admin/AdminDashboard";
import AdminLayout from "./Components/Admin/AdminLayout";
import TeamItemGenerator from "./Components/Items/TeamItemGenerator";

const checkAccess = (path: string) => {
  const userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}");
  const role = userInfo.role;

  if (role === "Admin" || role === "Developer") return true;

  const allowedPaths = roleBasedAccess[role]?.allowedPaths;
  return allowedPaths?.includes(path) || false;
};

function AppInner() {
  const { hasUnsavedChanges } = useUnsavedChanges();

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route element={<PrivateRoute />}>
          <Route element={<Layout handleVendorRegistrationOpen={undefined} />}>
            <Route
              path="/home"
              element={
                checkAccess("/home") ? <HomePage /> : <Navigate to="/home" />
              }
            />
            <Route
              path="/requisition-form"
              element={
                checkAccess("/requisition-form") ? (
                  <RequisitionForm />
                ) : (
                  <Navigate to="/home" />
                )
              }
            />
            <Route
              path="/edit-requisition"
              element={
                checkAccess("/edit-requisition") ? (
                  <EditRequisition />
                ) : (
                  <Navigate to="/home" />
                )
              }
            />
            <Route
              path="/approval-table"
              element={
                checkAccess("/approval-table") ? (
                  <ApprovalTable />
                ) : (
                  <Navigate to="/home" />
                )
              }
            />
            <Route
              path="/master-table"
              element={
                checkAccess("/master-table") ? (
                  <MasterSheet />
                ) : (
                  <Navigate to="/home" />
                )
              }
            />
            <Route
              path="/inward"
              element={
                checkAccess("/inward") ? (
                  <InwardForm />
                ) : (
                  <Navigate to="/home" />
                )
              }
            />
            <Route
              path="/invoice-tracker"
              element={
                checkAccess("/invoice-tracker") ? (
                  <InvoiceTracker />
                ) : (
                  <Navigate to="/home" />
                )
              }
            />
            <Route
              path="/inventory"
              element={
                checkAccess("/inventory") ? (
                  <InventoryForm />
                ) : (
                  <Navigate to="/home" />
                )
              }
            />

            <Route
              path="/rejected-materials"
              element={<RejectedMaterialManager />}
            />

            <Route
              path="/gatepass"
              element={
                checkAccess("/gatepass") ? (
                  <GatePassList />
                ) : (
                  <Navigate to="/home" />
                )
              }
            />
            <Route
              path="/returnable"
              element={
                checkAccess("/returnable") ? (
                  <ReturnableGatePass />
                ) : (
                  <Navigate to="/home" />
                )
              }
            />
            <Route
              path="/PO"
              element={
                checkAccess("/PO") ? <POFilter /> : <Navigate to="/home" />
              }
            />
            <Route
              path="/outward"
              element={
                checkAccess("/outward") ? (
                  <OutwardStock />
                ) : (
                  <Navigate to="/home" />
                )
              }
            />
            <Route
              path="/allocate"
              element={
                checkAccess("/allocate") ? (
                  <Allocate />
                ) : (
                  <Navigate to="/home" />
                )
              }
            />
            <Route
              path="/item-generator"
              element={
                checkAccess("/item-generator") ? (
                  <TeamItemGenerator />
                ) : (
                  <Navigate to="/home" />
                )
              }
            />
            <Route
              path="/item-approval"
              element={
                checkAccess("/item-approval") ? (
                  <ItemApproval />
                ) : (
                  <Navigate to="/home" />
                )
              }
            />
            <Route
              path="/item-submitter"
              element={
                checkAccess("/item-submitter") ? (
                  <ItemSubmitter />
                ) : (
                  <Navigate to="/home" />
                )
              }
            />
            <Route
              path="/item-data"
              element={
                checkAccess("/item-data") ? (
                  <ItemMasterDataGrid />
                ) : (
                  <Navigate to="/home" />
                )
              }
            />
            <Route
              path="/vendor-registration"
              element={
                checkAccess("/vendor-registration") ? (
                  <VendorRegistration />
                ) : (
                  <Navigate to="/home" />
                )
              }
            />
            <Route
              path="/vendor-approval"
              element={
                checkAccess("/vendor-approval") ? (
                  <VendorApproval />
                ) : (
                  <Navigate to="/home" />
                )
              }
            />
            <Route
              path="/vendor-edit"
              element={
                checkAccess("/vendor-edit") ? (
                  <VendorEditForm />
                ) : (
                  <Navigate to="/home" />
                )
              }
            />
            <Route
              path="/vendor-data"
              element={
                checkAccess("/vendor-data") ? (
                  <VendorDataGrid />
                ) : (
                  <Navigate to="/home" />
                )
              }
            />
            <Route
              path="/requisition-verification"
              element={
                checkAccess("/requisition-verification") ? (
                  <RequisitionVerification />
                ) : (
                  <Navigate to="/home" />
                )
              }
            />
            <Route
              path="/po-approval"
              element={
                checkAccess("/po-approval") ? (
                  <POApproval />
                ) : (
                  <Navigate to="/home" />
                )
              }
            />
            <Route
              path="/po-edit"
              element={
                checkAccess("/po-edit") ? <EditPO /> : <Navigate to="/home" />
              }
            />
            <Route
              path="/po-line-items"
              element={
                checkAccess("/po-line-items") ? (
                  <POLineItems />
                ) : (
                  <Navigate to="/home" />
                )
              }
            />
            <Route
              path="/po-preview/:id"
              element={
                checkAccess("/po-preview") ? (
                  <POPreviewPrint />
                ) : (
                  <Navigate to="/home" />
                )
              }
            />
          </Route>
        </Route>

        {/* Admin Routes - Simplified */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/*" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <UnsavedChangesProvider>
      <AppInner />
    </UnsavedChangesProvider>
  );
}

export default App;
