import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Button,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Snackbar,
  Alert,
} from "@mui/material";
import {
  DataGrid,
  GridColDef,
  GridRowModes,
  GridRowModesModel,
  GridRowId,
} from "@mui/x-data-grid";
import CloseIcon from "@mui/icons-material/Close";
import RevisionHistory from "../../Shared/RevisionHistory";
import axios from "axios";
import configuration from "../../../configuration";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";

interface DataGridPopupProps {
  open: boolean;
  data: any[];
  onClose: () => void;
  onSubmit: (data: any[]) => void;
}

const DataGridPopup: React.FC<DataGridPopupProps> = ({
  open,
  data,
  onClose,
  onSubmit,
}) => {
  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({});
  const [rows, setRows] = React.useState<any[]>(
    (data || []).filter((row) => row.approved_status === false)
  );
  const [selectedRows, setSelectedRows] = React.useState<any[]>([]);
  const [revisionHistory, setRevisionHistory] = useState([]);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error">(
    "success"
  );

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await axios.get(
          `${configuration.api_url}/api/requisition-history/by_batch/`,
          { params: { batch_id: data[0]?.batch_id } }
        );
        setRevisionHistory(response.data);
      } catch (error) {
        console.error("Error fetching revision history:", error);
      }
    };

    if (data?.length > 0) {
      fetchHistory();
    }
  }, [data]);

  const handleProcessRowUpdate = (newRow: any) => {
    const updatedRows = rows.map((row) =>
      row.id === newRow.id ? { ...newRow, approved_status: false } : row
    );
    setRows(updatedRows);
    return newRow;
  };

  const handleSelectionChange = (newSelection: any) => {
    const selectedRowData = rows.filter((row) => newSelection.includes(row.id));
    setSelectedRows(selectedRowData);

    // Get unique project codes from selected rows
    const uniqueProjectCodes = [
      ...new Set(
        selectedRowData.map((row) => row.project_code).filter((code) => code) // Remove empty/null values
      ),
    ];

    // Create combined project code string
    const combinedProjectCode = uniqueProjectCodes.join(", ");

    // Update all selected rows with the combined project code
    if (selectedRowData.length > 0) {
      const updatedRows = rows.map((row) =>
        newSelection.includes(row.id)
          ? { ...row, project_code: combinedProjectCode }
          : row
      );
      setRows(updatedRows);
    }
  };

  const handleEditClick = (id: GridRowId) => () => {
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.Edit } });
  };

  const handleSaveClick = (id: GridRowId) => () => {
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.View } });
  };

  const handleCancelClick = (id: GridRowId) => () => {
    setRowModesModel({
      ...rowModesModel,
      [id]: { mode: GridRowModes.View, ignoreModifications: true },
    });
  };

  const columns: GridColDef[] = [
    {
      field: "actions",
      headerName: "Actions",
      type: "actions",
      width: 100,
      renderCell: (params) => {
        const isInEditMode =
          rowModesModel[params.id]?.mode === GridRowModes.Edit;

        if (isInEditMode) {
          return (
            <>
              <IconButton onClick={handleSaveClick(params.id)}>
                <SaveIcon />
              </IconButton>
              <IconButton onClick={handleCancelClick(params.id)}>
                <CancelIcon />
              </IconButton>
            </>
          );
        }

        return (
          <IconButton onClick={handleEditClick(params.id)}>
            <EditIcon />
          </IconButton>
        );
      },
    },
    { field: "item_no", headerName: "Item No", width: 150, editable: true },
    {
      field: "cimcon_part_number",
      headerName: "CIMCON Part Number",
      width: 200,
      editable: true,
    },
    {
      field: "material_description",
      headerName: "Material Description",
      width: 250,
      editable: true,
    },
    {
      field: "req_qty",
      headerName: "Required Quantity",
      width: 150,
      editable: true,
    },
    {
      field: "mfg_part_number",
      headerName: "MFG Part Number",
      width: 200,
      editable: true,
    },
    { field: "make", headerName: "Make", width: 150, editable: true },
    {
      field: "material_group",
      headerName: "Material Group",
      width: 150,
      editable: true,
    },
    { field: "unit", headerName: "Unit", width: 100, editable: true },
    {
      field: "required_by_date",
      headerName: "Required By Date",
      width: 150,
      editable: true,
    },
    { field: "remarks", headerName: "Remarks", width: 200, editable: true },
    {
      field: "project_code",
      headerName: "Project Code",
      width: 150,
      editable: true,
    },
  ];

  const handleSave = () => {
    onSubmit(rows);
    setSnackbarMessage("Requisition updated successfully!");
    setSnackbarSeverity("success");
    setSnackbarOpen(true);
  };

  const NoRowsMessage = () => (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
        padding: "20px",
      }}
    >
      <Typography variant="body1" color="text.secondary">
        No unapproved requisitions available
      </Typography>
    </Box>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      PaperProps={{
        style: {
          borderRadius: "16px",
          padding: "16px",
          background: "linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)",
          maxHeight: "90vh", // Limit maximum height to 90% of viewport
          overflowY: "auto", // Enable vertical scrolling if needed
        },
      }}
    >
      <DialogTitle
        sx={{
          fontSize: "1.5rem",
          fontWeight: 600,
          color: "#2c3e50",
          textAlign: "center",
        }}
      >
        Edit Unapproved Requisitions
      </DialogTitle>
      <DialogContent sx={{ padding: "16px 24px" }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <Box sx={{ width: "100%" }}>
            <DataGrid
              rows={rows}
              columns={columns}
              processRowUpdate={handleProcessRowUpdate}
              autoHeight
              disableRowSelectionOnClick
              getRowId={(row) => row.id}
              checkboxSelection
              onRowSelectionModelChange={handleSelectionChange}
              editMode="row"
              rowModesModel={rowModesModel}
              onRowModesModelChange={(newModel) => setRowModesModel(newModel)}
              components={{
                NoRowsOverlay: NoRowsMessage,
              }}
              sx={{
                border: "none",
                "& .MuiDataGrid-cell": {
                  borderColor: "rgba(0, 0, 0, 0.1)",
                },
                "& .MuiDataGrid-columnHeaders": {
                  backgroundColor: "rgba(33, 150, 243, 0.1)",
                  color: "#2c3e50",
                },
                "& .MuiDataGrid-row:hover": {
                  backgroundColor: "rgba(33, 150, 243, 0.05)",
                },
              }}
            />
          </Box>

          <Box
            sx={{
              width: "100%",
              border: "1px solid rgba(224, 224, 224, 1)",
              borderRadius: "8px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            }}
          >
            <RevisionHistory history={revisionHistory} />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ padding: "16px" }}>
        <Button
          onClick={onClose}
          sx={{
            color: "#7c4dff",
            "&:hover": {
              backgroundColor: "rgba(124, 77, 255, 0.1)",
            },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          sx={{
            background: "linear-gradient(45deg, #2196f3, #7c4dff)",
            borderRadius: "8px",
            "&:hover": {
              transform: "translateY(-2px)",
              boxShadow: "0 6px 12px rgba(33, 150, 243, 0.2)",
            },
          }}
        >
          Save Changes
        </Button>
      </DialogActions>

      {/* Snackbar for success message */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
          sx={{ width: "100%" }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Dialog>
  );
};

export default DataGridPopup;
