import React, { useState } from "react";
import {
  Box,
  Container, // Add this import
  Fade,
  Slide,
  Typography,
  Paper,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import SearchAutocomplete from "./SearchAutocomplete";
import BatchCards from "./BatchCards";
import DataGridPopup from "./DataGridPopup";
import axios from "axios";
import "./edit_requisition.scss";
import configuration from "../../../configuration";

interface Batch {
  id: number;
  batch_id: string;
  project_code: string;
  requisition_date: string;
  cimcon_part_number: string;
  req_qty: number;
  remarks: string;
  approved_status: boolean;
  status?: "pending" | "approved" | "rejected";
  rejection_remarks?: string;
  material_description?: string;
  total_items?: number;
}

// Add this interface for tracking changes
interface ChangeRecord {
  field: string;
  oldValue: any;
  newValue: any;
  timestamp: string;
}

const EditRequisition: React.FC = () => {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<Batch[] | null>(null);
  const [openPopup, setOpenPopup] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [changeHistory, setChangeHistory] = useState<
    Record<number, ChangeRecord[]>
  >({});
  const [snackbarState, setSnackbarState] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "warning";
  }>({
    open: false,
    message: "",
    severity: "success",
  });

  // Fetch batches for selected project
  const fetchBatches = async (projectCode: string) => {
    try {
      // Clear existing batches when fetching new ones
      setBatches([]);
      setSelectedProject(null);

      setLogs((prevLogs) => [
        ...prevLogs,
        `Fetching batches for project: ${projectCode}`,
      ]);
      const response = await axios.get(
        `${configuration.api_url}/requisitions?project_id=${projectCode}`
      );

      // Filter to only include batches matching the selected project code
      const filteredData = response.data.filter(
        (row: Batch) => row.project_code === projectCode
      );

      // Ensure each row has a unique ID
      const rowsWithIds = filteredData.map((row: Batch) => ({
        ...row,
        id: row.id,
      }));

      setBatches(rowsWithIds);
      setSelectedProject(projectCode);
      setLogs((prevLogs) => [
        ...prevLogs,
        `${rowsWithIds.length} requisitions loaded for project ${projectCode}.`,
      ]);
    } catch (error) {
      console.error("Error fetching batches:", error);
      setLogs((prevLogs) => [...prevLogs, "Error fetching batches."]);
    }
  };

  // Handle card click: Filter rows by batch_id and show in popup
  const handleCardClick = (batch: Batch) => {
    // Prevent editing if the batch is approved
    if (batch.approved_status || batch.status === "approved") {
      showSnackbar("Approved requisitions cannot be edited", "warning");
      return;
    }

    // Get all rows with the same batch_id and project code
    const batchRows = batches.filter(
      (b) => b.batch_id === batch.batch_id && b.project_code === selectedProject
    );
    setSelectedBatch(batchRows);
    setOpenPopup(true);
    setLogs((prevLogs) => [...prevLogs, `Editing batch: ${batch.batch_id}`]);
  };

  // Add function to show snackbar
  const showSnackbar = (
    message: string,
    severity: "success" | "error" | "warning"
  ) => {
    setSnackbarState({
      open: true,
      message,
      severity,
    });
  };

  // Add function to save revision history
  const saveRevisionHistory = async (
    requisitionId: number,
    changes: ChangeRecord[],
    batchId: string
  ) => {
    try {
      const payload = {
        requisition_id: requisitionId,
        changes: changes.map((change) => ({
          field_name: change.field,
          old_value: change.oldValue,
          new_value: change.newValue,
          changed_by: localStorage.getItem("name") || "unknown",
          batch_id: batchId,
        })),
        approved_by: localStorage.getItem("approver_name") || "unknown",
      };

      console.log("Payload for revision history:", payload);

      const response = await axios.post(
        `${configuration.api_url}api/requisition-history/`,
        payload
      );

      console.log("Revision history saved successfully:", response.data);
    } catch (error) {
      console.error("Error saving revision history:", error);
    }
  };

  // Modify updateRequisition to include revision history saving
  const updateRequisition = async (updatedData: Batch[]) => {
    if (selectedBatch) {
      try {
        // Track what changed
        const changes: Record<number, ChangeRecord[]> = {};
        updatedData.forEach((newData) => {
          const oldData = selectedBatch.find(
            (batch) => batch.id === newData.id
          );
          if (oldData) {
            const batchChanges: ChangeRecord[] = [];
            Object.keys(newData).forEach((key) => {
              if (key !== "id" && newData[key] !== oldData[key]) {
                batchChanges.push({
                  field: key,
                  oldValue: oldData[key],
                  newValue: newData[key],
                  timestamp: new Date().toISOString(),
                });
              }
            });
            if (batchChanges.length > 0) {
              changes[newData.id] = batchChanges;
            }
          }
        });

        // Save changes to backend
        await Promise.all(
          updatedData.map(async (data) => {
            // Update requisition with reset status
            await axios.put(
              `${configuration.api_url}requisitions/update/${data.id}/`,
              {
                ...data,
                approved_status: false,
                status: "pending", // Reset status to pending
                rejection_remarks: null, // Clear rejection remarks
              },
              { headers: { "Content-Type": "application/json" } }
            );

            // Log the details of the successful update
            if (changes[data.id]) {
              const logDetails = {
                requisition_id: data.id,
                changes: [
                  ...changes[data.id],
                  // Add status change to history
                  {
                    field: "status",
                    oldValue: "rejected",
                    newValue: "pending",
                    timestamp: new Date().toISOString(),
                  },
                ],
                updated_by: localStorage.getItem("username") || "unknown",
                timestamp: new Date().toISOString(),
              };

              const approverName =
                localStorage.getItem("approver_name") || "unknown";

              // Send the log details to the backend
              await axios.post(
                `${configuration.api_url}api/requisition-history/`,
                {
                  requisition_id: data.id,
                  changes: logDetails.changes.map((change) => ({
                    field_name: change.field,
                    old_value: change.oldValue,
                    new_value: change.newValue,
                  })),
                  changed_by: logDetails.updated_by,
                  approved_by_name: approverName,
                }
              );
            }
          })
        );

        setShowSuccess(true);
        setOpenPopup(false);
        if (selectedProject) {
          await fetchBatches(selectedProject);
        }
      } catch (error) {
        console.error("Error updating requisition:", error);
        setLogs((prevLogs) => [...prevLogs, "Error updating requisition."]);
      }
    }
  };

  // Update the filtering logic for both approved and unapproved rows
  const unapprovedRows = batches.filter(
    (batch) =>
      batch.project_code === selectedProject &&
      !batch.approved_status &&
      batch.status !== "approved"
  );

  const approvedRows = batches.filter(
    (batch) =>
      batch.project_code === selectedProject &&
      (batch.approved_status || batch.status === "approved")
  );

  return (
    <Box className="edit-requisition">
      {/* Step 1: Search Section */}
      <Slide direction="down" in timeout={500}>
        <Container maxWidth="xl" className="content-container">
          <Paper elevation={3} className="search-section">
            {/* <Typography variant="h4" className="section-title">
              Search Project
            </Typography> */}
            <Box className="search-box">
              <SearchAutocomplete onSelect={fetchBatches} />
            </Box>
          </Paper>
        </Container>
      </Slide>

      {/* Content Section */}
      {selectedProject && (
        <Container maxWidth="xl" className="content-container">
          {batches.length > 0 ? (
            <>
              {/* Unapproved Section */}
              <Fade in timeout={800}>
                <Box className="cards-section unapproved-section">
                  <Typography variant="h5" className="section-title">
                    Unapproved / Pending
                  </Typography>
                  <BatchCards
                    batches={unapprovedRows}
                    onCardClick={handleCardClick}
                  />
                </Box>
              </Fade>

              {/* Approved Section */}
              <Fade in timeout={800}>
                <Box className="cards-section approved-section">
                  <Typography variant="h5" className="section-title">
                    Approved
                  </Typography>
                  <BatchCards
                    batches={approvedRows}
                    onCardClick={handleCardClick}
                  />
                </Box>
              </Fade>
            </>
          ) : (
            <Paper className="no-results">
              <Typography variant="h6" align="center">
                No requisitions found for project {selectedProject}
              </Typography>
            </Paper>
          )}

          {/* Logs Section */}
          {/* {logs.length > 0 && (
            <Slide direction="up" in timeout={800}>
              <Paper className="logs-section">
                <Typography variant="h6" className="section-title">
                  Activity Logs
                </Typography>
                <Box className="logs-container">
                  {logs.map((log, index) => (
                    <Box key={index} className="log-entry">
                      {log}
                    </Box>
                  ))}
                </Box>
              </Paper>
            </Slide>
          )} */}
        </Container>
      )}

      {/* DataGrid Popup */}
      {openPopup && selectedBatch && (
        <DataGridPopup
          open={openPopup}
          data={selectedBatch}
          onClose={() => {
            setLogs((prevLogs) => [
              ...prevLogs,
              `Closed popup for batch: ${selectedBatch[0].batch_id}`,
            ]);
            setOpenPopup(false);
          }}
          onSubmit={updateRequisition}
          changeHistory={changeHistory}
        />
      )}

      {/* Snackbar for success/error messages */}
      <Snackbar
        open={snackbarState.open}
        autoHideDuration={6000}
        onClose={() => setSnackbarState((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnackbarState((prev) => ({ ...prev, open: false }))}
          severity={snackbarState.severity}
          sx={{ width: "100%" }}
        >
          {snackbarState.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default EditRequisition;
