import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  TextField,
  Autocomplete,
  Button,
  Snackbar,
  Alert,
  CircularProgress,
  Box,
  Typography,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Checkbox,
  Collapse,
  Backdrop,
} from "@mui/material";
import RevisionHistory from "../Shared/RevisionHistory";
import "./approval.scss";
import configuration from "../../configuration";
import WorkflowStepper from "../Shared/WorkflowStepper";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";

const ApprovalTable: React.FC = () => {
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [groupedRequisitions, setGroupedRequisitions] = useState<any>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error">(
    "success"
  );
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(
    null
  );
  const [previewData, setPreviewData] = useState<any[]>([]); // State for preview data
  const [selectedItems, setSelectedItems] = useState<{
    [key: string]: boolean;
  }>({}); // Track selected items
  const [visibleItems, setVisibleItems] = useState<{ [key: string]: boolean }>(
    {}
  ); // Track visibility of items
  const [revisionHistories, setRevisionHistories] = useState<
    Record<string, any[]>
  >({});
  const [rejectionRemarks, setRejectionRemarks] = useState<string>("");
  const [apiLoading, setApiLoading] = useState<boolean>(false);

  useEffect(() => {
    setLoading(true);
    setApiLoading(true);
    console.log("Fetching requisitions...");
    axios
      .get(`${configuration.api_url}/requisitions/`)
      .then((response) => {
        console.log("Fetched Requisitions:", response.data);

        const filtered = response.data.filter(
          (req: any) => !req.approved_status && req.status !== "approved"
        );

        const grouped = filtered.reduce((acc: any, req: any) => {
          acc[req.batch_id] = acc[req.batch_id] || [];
          acc[req.batch_id].push(req);
          return acc;
        }, {});

        setGroupedRequisitions(grouped);
        setRequisitions(filtered);
        setLoading(false);
        setApiLoading(false);
        console.log("Requisitions loaded and grouped successfully.");
      })
      .catch((error) => {
        setLoading(false);
        setApiLoading(false);
        console.error("Error fetching requisitions:", error);
        showSnackbar(
          "Failed to load requisitions. Please try again later.",
          "error"
        );
      });
  }, []);

  const fetchRevisionHistory = async (batchId: string) => {
    setApiLoading(true);
    try {
      const response = await axios.get(
        `${configuration.api_url}/api/requisition-history/by_batch/`,
        { params: { batch_id: batchId } }
      );
      setRevisionHistories((prev) => ({
        ...prev,
        [batchId]: response.data,
      }));
    } catch (error) {
      console.error("Error fetching revision history:", error);
      showSnackbar("Failed to load revision history", "error");
    } finally {
      setApiLoading(false);
    }
  };

  const handleAction = async (
    batchId: string,
    action: "approve" | "reject"
  ) => {
    console.log(`Action requested: ${action} for batch ID: ${batchId}`);
    if (action === "reject") {
      setSelectedBatchId(batchId);
      setActionType(action);
      setOpenDialog(true);
    } else {
      const itemsToApprove = groupedRequisitions[batchId]
        .filter((item: any) => selectedItems[item.id])
        .map((item: any) => item.id);

      if (itemsToApprove.length > 0) {
        console.log(`Items to approve: ${itemsToApprove}`);
        await processAction(batchId, action, itemsToApprove);
      } else {
        showSnackbar("No items selected for approval.", "error");
      }
    }
  };

  const processAction = async (
    batchId: string,
    action: "approve" | "reject",
    itemsToApprove: string[] = []
  ) => {
    setApiLoading(true);
    try {
      const url = `${configuration.api_url}/requisitions/${
        action === "approve" ? "batch-approve" : "batch-reject"
      }/`;

      if (action === "approve") {
        await axios.post(url, { batch_id: batchId, items: itemsToApprove });
      } else {
        if (!rejectionRemarks.trim()) {
          showSnackbar("Please provide rejection remarks", "error");
          setApiLoading(false);
          return;
        }

        await axios.post(url, {
          batch_id: batchId,
          rejection_remarks: rejectionRemarks,
        });
      }

      showSnackbar(
        `${action === "approve" ? "Approved" : "Rejected"} successfully!`,
        "success"
      );

      setRejectionRemarks("");

      console.log("Refreshing requisitions after action...");
      const response = await axios.get(
        `${configuration.api_url}/requisitions/`
      );
      const filtered = response.data.filter((req: any) => !req.approved_status);
      const grouped = filtered.reduce((acc: any, req: any) => {
        acc[req.batch_id] = acc[req.batch_id] || [];
        acc[req.batch_id].push(req);
        return acc;
      }, {});
      setGroupedRequisitions(grouped);
      setRequisitions(filtered);
      console.log("Requisitions refreshed successfully.");
    } catch (error) {
      console.error("Error handling requisition action:", error);
      showSnackbar("Failed to process the action. Try again.", "error");
    } finally {
      setApiLoading(false);
    }
  };

  const handleConfirmReject = () => {
    console.log(`Confirming rejection for batch ID: ${selectedBatchId}`);
    if (selectedBatchId && actionType) {
      processAction(selectedBatchId, actionType);
    }
    setOpenDialog(false);
  };

  const handleCancelReject = () => {
    console.log("Rejection action cancelled.");
    setOpenDialog(false);
  };

  const showSnackbar = (message: string, severity: "success" | "error") => {
    console.log(`Snackbar message: ${message}, Severity: ${severity}`);
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handlePreview = async (batchId: string) => {
    console.log(`Toggling preview for batch ID: ${batchId}`);
    setVisibleItems((prev) => ({
      ...prev,
      [batchId]: !prev[batchId],
    }));

    if (!visibleItems[batchId] && !revisionHistories[batchId]) {
      await fetchRevisionHistory(batchId);
    }
  };

  return (
    <Box className="approval-container">
      <Backdrop
        sx={{
          color: "#fff",
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: "rgba(0, 0, 0, 0.7)",
        }}
        open={apiLoading}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
          }}
        >
          <CircularProgress color="inherit" size={60} />
          <Typography variant="h6" color="inherit">
            Processing... Please wait
          </Typography>
        </Box>
      </Backdrop>

      <WorkflowStepper
        activeStep={1}
        requisitionDate={requisitions[0]?.requisition_date}
      />

      {loading ? (
        <Box className="loading-container">
          <CircularProgress size={48} />
          <Typography variant="h6">Loading Requisitions...</Typography>
        </Box>
      ) : (
        <Box className="approval-table">
          {Object.keys(groupedRequisitions).length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Batch ID</th>
                  <th>Project Details</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedRequisitions).map(([batchId, items]) => (
                  <React.Fragment key={batchId}>
                    <tr>
                      <td>{batchId}</td>
                      <td>
                        <Box
                          sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.5rem",
                          }}
                        >
                          <Typography
                            variant="subtitle1"
                            sx={{ fontWeight: 600 }}
                          >
                            {items[0]?.project_code}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {items.length} Items Pending Approval
                          </Typography>
                        </Box>
                      </td>
                      <td>
                        <Box
                          sx={{
                            display: "inline-flex",
                            padding: "0.5rem 1rem",
                            borderRadius: "1rem",
                            background:
                              items[0]?.status === "rejected"
                                ? "rgba(255, 82, 82, 0.1)"
                                : "rgba(255, 152, 0, 0.1)",
                            color:
                              items[0]?.status === "rejected"
                                ? "#ff5252"
                                : "#ff9800",
                            fontWeight: 600,
                            fontSize: "0.875rem",
                          }}
                        >
                          {items[0]?.status === "rejected"
                            ? "Rejected"
                            : "Pending"}
                        </Box>
                      </td>
                      <td>
                        <Button
                          variant="outlined"
                          className="preview-btn"
                          onClick={() => handlePreview(batchId)}
                        >
                          {visibleItems[batchId]
                            ? "Hide Details"
                            : "View Details"}
                        </Button>
                      </td>
                    </tr>
                    {visibleItems[batchId] && (
                      <>
                        <tr className="expanded-row">
                          <td colSpan={4} style={{ padding: 0 }}>
                            <Box
                              sx={{
                                p: 2,
                                backgroundColor: "#f0f7ff",
                                borderBottom: "1px solid #ccc",
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 3,
                              }}
                            >
                              <Box sx={{ minWidth: "200px" }}>
                                <Typography
                                  variant="overline"
                                  color="text.secondary"
                                >
                                  Project Details
                                </Typography>
                                <Typography
                                  variant="subtitle1"
                                  fontWeight="bold"
                                >
                                  {items[0]?.project_code}
                                </Typography>
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  Project: {items[0]?.project || "N/A"}
                                </Typography>
                              </Box>

                              <Box sx={{ minWidth: "200px" }}>
                                <Typography
                                  variant="overline"
                                  color="text.secondary"
                                >
                                  Timeline
                                </Typography>
                                <Typography variant="body2">
                                  <strong>Requisition Date:</strong>{" "}
                                  {items[0]?.requisition_date
                                    ? new Date(
                                        items[0].requisition_date
                                      ).toLocaleDateString("en-US", {
                                        year: "numeric",
                                        month: "short",
                                        day: "numeric",
                                      })
                                    : "N/A"}
                                </Typography>
                                <Typography variant="body2">
                                  <strong>Required By:</strong>{" "}
                                  {items[0]?.required_by_date
                                    ? new Date(
                                        items[0].required_by_date
                                      ).toLocaleDateString("en-US", {
                                        year: "numeric",
                                        month: "short",
                                        day: "numeric",
                                      })
                                    : "N/A"}
                                </Typography>
                              </Box>

                              <Box sx={{ minWidth: "200px" }}>
                                <Typography
                                  variant="overline"
                                  color="text.secondary"
                                >
                                  Submitted By
                                </Typography>
                                <Typography variant="body1">
                                  {items[0]?.submitted_by || "N/A"}
                                </Typography>
                              </Box>

                              {items[0]?.status === "rejected" && (
                                <Box
                                  sx={{
                                    flexBasis: "100%",
                                    mt: 1,
                                    p: 1,
                                    backgroundColor: "#ffebee",
                                    borderRadius: "4px",
                                  }}
                                >
                                  <Typography variant="overline" color="error">
                                    Rejection Remarks
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    color="error.dark"
                                  >
                                    {items[0]?.rejection_remarks ||
                                      "No remarks provided"}
                                  </Typography>
                                </Box>
                              )}
                            </Box>

                            <Box
                              sx={{
                                px: 2,
                                py: 1,
                                backgroundColor: "#eee",
                                display: "flex",
                                alignItems: "center",
                              }}
                            >
                              <Checkbox
                                sx={{ ml: -1 }}
                                onChange={(e) => {
                                  const newSelectedItems = { ...selectedItems };
                                  items.forEach((item) => {
                                    newSelectedItems[item.id] =
                                      e.target.checked;
                                  });
                                  setSelectedItems(newSelectedItems);
                                }}
                              />
                              <Typography
                                variant="subtitle1"
                                sx={{ fontWeight: 600, ml: 1 }}
                              >
                                {items.length} Items to Review:
                              </Typography>
                            </Box>

                            <Box sx={{ maxHeight: "400px", overflowY: "auto" }}>
                              {items.map((item: any) => (
                                <Box
                                  key={item.id}
                                  sx={{
                                    display: "flex",
                                    borderBottom: "1px solid #eee",
                                    p: 2,
                                    backgroundColor:
                                      item.status === "rejected"
                                        ? "#fff8f8"
                                        : "white",
                                    transition: "background-color 0.2s",
                                    "&:hover": {
                                      backgroundColor:
                                        item.status === "rejected"
                                          ? "#fff0f0"
                                          : "#f5f5f5",
                                    },
                                  }}
                                >
                                  <Checkbox
                                    checked={!!selectedItems[item.id]}
                                    onChange={(e) => {
                                      setSelectedItems((prev) => ({
                                        ...prev,
                                        [item.id]: e.target.checked,
                                      }));
                                    }}
                                  />

                                  <Box sx={{ flex: 1, ml: 1 }}>
                                    <Box
                                      sx={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        mb: 1,
                                      }}
                                    >
                                      <Box>
                                        <Typography
                                          variant="subtitle1"
                                          sx={{ fontWeight: 600 }}
                                        >
                                          {item.material_description}
                                        </Typography>
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                        >
                                          Item #{item.item_no} • CIMCON P/N:{" "}
                                          {item.cimcon_part_number}
                                        </Typography>
                                      </Box>

                                      <Box
                                        sx={{
                                          display: "inline-flex",
                                          padding: "0.25rem 0.75rem",
                                          borderRadius: "1rem",
                                          alignItems: "center",
                                          height: "fit-content",
                                          background:
                                            item.status === "rejected"
                                              ? "rgba(255, 82, 82, 0.1)"
                                              : "rgba(255, 152, 0, 0.1)",
                                          color:
                                            item.status === "rejected"
                                              ? "#ff5252"
                                              : "#ff9800",
                                          fontWeight: 600,
                                          fontSize: "0.75rem",
                                        }}
                                      >
                                        {item.status.charAt(0).toUpperCase() +
                                          item.status.slice(1)}
                                      </Box>
                                    </Box>

                                    <Box
                                      sx={{
                                        display: "grid",
                                        gridTemplateColumns:
                                          "repeat(auto-fill, minmax(200px, 1fr))",
                                        gap: 2,
                                        mb: 1,
                                      }}
                                    >
                                      <Box>
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                        >
                                          Make
                                        </Typography>
                                        <Typography variant="body2">
                                          {item.make || "N/A"}
                                        </Typography>
                                      </Box>

                                      <Box>
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                        >
                                          Material Group
                                        </Typography>
                                        <Typography variant="body2">
                                          {item.material_group || "N/A"}
                                        </Typography>
                                      </Box>

                                      <Box>
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                        >
                                          MFG Part No
                                        </Typography>
                                        <Typography variant="body2">
                                          {item.mfg_part_number || "N/A"}
                                        </Typography>
                                      </Box>

                                      <Box>
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                        >
                                          Required Date
                                        </Typography>
                                        <Typography variant="body2">
                                          {item.required_by_date
                                            ? new Date(
                                                item.required_by_date
                                              ).toLocaleDateString()
                                            : "N/A"}
                                        </Typography>
                                      </Box>
                                    </Box>

                                    <Box
                                      sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        flexWrap: "wrap",
                                        gap: 2,
                                      }}
                                    >
                                      <Box
                                        sx={{
                                          backgroundColor: "#e3f2fd",
                                          padding: "0.25rem 0.75rem",
                                          borderRadius: "1rem",
                                          fontWeight: 600,
                                        }}
                                      >
                                        <Typography variant="body2">
                                          Qty: {item.req_qty} {item.unit}
                                        </Typography>
                                      </Box>

                                      {item.verified && (
                                        <Box
                                          sx={{
                                            backgroundColor: "#e8f5e9",
                                            padding: "0.25rem 0.75rem",
                                            borderRadius: "1rem",
                                            fontWeight: 600,
                                          }}
                                        >
                                          <Typography
                                            variant="body2"
                                            color="success.main"
                                          >
                                            Verified
                                          </Typography>
                                        </Box>
                                      )}

                                      {item.master_entry_exists && (
                                        <Box
                                          sx={{
                                            backgroundColor: "#fff3e0",
                                            padding: "0.25rem 0.75rem",
                                            borderRadius: "1rem",
                                            fontWeight: 600,
                                          }}
                                        >
                                          <Typography
                                            variant="body2"
                                            color="warning.dark"
                                          >
                                            Master Entry Exists
                                          </Typography>
                                        </Box>
                                      )}
                                    </Box>

                                    {item.remarks && (
                                      <Box
                                        sx={{
                                          mt: 1,
                                          backgroundColor: "#f5f5f5",
                                          p: 1,
                                          borderRadius: "4px",
                                        }}
                                      >
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                        >
                                          Remarks:
                                        </Typography>
                                        <Typography variant="body2">
                                          {item.remarks}
                                        </Typography>
                                      </Box>
                                    )}
                                  </Box>
                                </Box>
                              ))}
                            </Box>

                            {revisionHistories[batchId] &&
                            revisionHistories[batchId].length > 0 ? (
                              <Box sx={{ mt: 2, px: 2, pb: 2 }}>
                                <Typography
                                  variant="h6"
                                  sx={{ mb: 1, fontSize: "1rem" }}
                                >
                                  Revision History
                                </Typography>
                                <RevisionHistory
                                  history={revisionHistories[batchId]}
                                  title=""
                                />
                              </Box>
                            ) : (
                              <Box
                                sx={{
                                  px: 2,
                                  py: 1,
                                  color: "text.secondary",
                                  fontStyle: "italic",
                                }}
                              >
                                <Typography variant="body2">
                                  No revision history available for this batch
                                </Typography>
                              </Box>
                            )}
                          </td>
                        </tr>

                        <tr className="action-row">
                          <td colSpan={4}>
                            <Box
                              className="action-buttons"
                              sx={{
                                p: 2,
                                backgroundColor: "#f9f9f9",
                                display: "flex",
                                justifyContent: "flex-end",
                                gap: 2,
                              }}
                            >
                              {items[0]?.status !== "rejected" ? (
                                <>
                                  <Button
                                    variant="contained"
                                    color="success"
                                    className="approve-btn"
                                    onClick={() =>
                                      handleAction(batchId, "approve")
                                    }
                                    startIcon={<CheckCircleIcon />}
                                    disabled={
                                      !Object.values(selectedItems).some(
                                        (val) => val
                                      )
                                    }
                                  >
                                    Approve Selected
                                  </Button>
                                  <Button
                                    variant="contained"
                                    color="error"
                                    className="reject-btn"
                                    onClick={() =>
                                      handleAction(batchId, "reject")
                                    }
                                    startIcon={<CancelIcon />}
                                  >
                                    Reject All
                                  </Button>
                                </>
                              ) : (
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                  sx={{ fontStyle: "italic" }}
                                >
                                  This requisition has been rejected. The user
                                  needs to edit and resubmit for approval.
                                </Typography>
                              )}
                            </Box>
                          </td>
                        </tr>
                      </>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          ) : (
            <Box sx={{ padding: "3rem", textAlign: "center" }}>
              <Typography variant="h6" color="text.secondary">
                No pending requisitions found.
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {previewData.length > 0 && (
        <Dialog
          open={Boolean(previewData.length)}
          onClose={() => setPreviewData([])}
        >
          <DialogTitle>Batch Preview</DialogTitle>
          <DialogContent>
            {previewData.map((req, idx) => (
              <Typography key={idx}>
                <strong>Item {idx + 1}:</strong> {req.material_description} -{" "}
                {req.req_qty} {req.unit}
              </Typography>
            ))}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPreviewData([])} color="primary">
              Close
            </Button>
          </DialogActions>
        </Dialog>
      )}

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
          sx={{ width: "100%" }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>

      <Dialog
        open={openDialog}
        onClose={handleCancelReject}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reject Requisition</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Please provide the reason for rejection. This will be visible to the
            requisition creator.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="Rejection Remarks"
            fullWidth
            multiline
            rows={4}
            value={rejectionRemarks}
            onChange={(e) => setRejectionRemarks(e.target.value)}
            placeholder="Enter detailed reason for rejection..."
            required
            error={openDialog && !rejectionRemarks.trim()}
            helperText={
              openDialog && !rejectionRemarks.trim()
                ? "Rejection remarks are required"
                : ""
            }
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              handleCancelReject();
              setRejectionRemarks("");
            }}
            color="primary"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmReject}
            color="error"
            variant="contained"
            disabled={!rejectionRemarks.trim()}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ApprovalTable;
