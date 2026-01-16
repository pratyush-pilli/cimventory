import React, { useState, useEffect } from "react";
// import { v4 as uuidv4 } from "uuid"; // Import UUID generator
import "./requisition_form.scss";
import "./Edit/edit_requisition.scss";
import CancelIcon from "@mui/icons-material/Cancel";
import {
  DataGrid,
  GridRowsProp,
  GridRowModesModel,
  GridRowModes,
  GridColDef,
  GridToolbar,
  GridRowId,
  GridRenderEditCellParams,
} from "@mui/x-data-grid";
import {
  TextField,
  Button,
  Typography,
  Box,
  Paper,
  Snackbar,
  Autocomplete,
  Grid,
  CircularProgress,
  Fab,
  Tooltip,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Slide,
  Container,
  MenuItem,
  Backdrop,
  Card,
  CardContent,
  CardHeader,
  Stepper,
  Step,
  StepLabel,
  Chip,
  Alert,
  LinearProgress,
  Stack,
  Divider,
} from "@mui/material";
import MuiAlert, { AlertProps } from "@mui/material/Alert";
import AddIcon from "@mui/icons-material/Add";
import SaveIcon from "@mui/icons-material/Save";
import axios from "axios";
import dayjs from "dayjs"; // Import dayjs for date handling
import configuration from "../../configuration";
import InfoIcon from "@mui/icons-material/Info";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SearchAutocomplete from "./Edit/SearchAutocomplete";
import AddProjectDialog from "../Shared/AddProject"; // Import the AddProjectDialog
import WorkflowStepper from "../Shared/WorkflowStepper";
import BusinessIcon from "@mui/icons-material/Business";
import PersonIcon from "@mui/icons-material/Person";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import InventoryIcon from "@mui/icons-material/Inventory";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningIcon from "@mui/icons-material/Warning";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
// import RevisionHistory from "../Shared/RevisionHistory";
const AlertComponent = React.forwardRef<HTMLDivElement, AlertProps>(
  function Alert(props, ref) {
    return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
  }
);

// Create a separate component for the edit cell
const CimconPartNumberEditCell = (
  props: GridRenderEditCellParams & { itemMasterData: any[] }
) => {
  const options = props.itemMasterData.map((item) => item.cimcon_part_no);

  const handlePartNumberChange = async (
    _event: any,
    newValue: string | null
  ) => {
    try {
      console.log("Selected part number:", newValue);
      console.log("Current row ID:", props.id);

      if (newValue) {
        const response = await axios.get(
          `${configuration.api_url}item-master-data/`
        );
        const selectedItem = response.data.find(
          (item: any) => item.cimcon_part_no === newValue
        );
        console.log("Found item details:", selectedItem);

        if (selectedItem) {
          // Create updates array for all fields that need to be updated
          const updates = [
            { field: "cimcon_part_number", value: newValue },
            { field: "mfg_part_number", value: selectedItem.mfg_part_no || "" },
            {
              field: "material_description",
              value: selectedItem.description || "",
            },
            { field: "make", value: selectedItem.make || "" },
            {
              field: "material_group",
              value: selectedItem.name || "",
            },
            { field: "unit", value: selectedItem.uom || "" },
          ];

          // Apply all updates
          updates.forEach((update) => {
            props.api.setEditCellValue(
              {
                id: props.id,
                field: update.field,
                value: update.value,
              },
              true
            );
          });
        }
      } else {
        // Clear all fields if no value is selected
        const fields = [
          "cimcon_part_number",
          "mfg_part_number",
          "material_description",
          "make",
          "material_group",
          "unit",
        ];

        fields.forEach((field) => {
          props.api.setEditCellValue(
            {
              id: props.id,
              field: field,
              value: "",
            },
            true
          );
        });
      }
    } catch (error) {
      console.error("Error updating fields:", error);
    }
  };

  return (
    <Autocomplete
      fullWidth
      value={props.value || null}
      onChange={handlePartNumberChange}
      options={options}
      loading={false}
      freeSolo={false}
      isOptionEqualToValue={(option, value) => option === value}
      renderInput={(params) => (
        <TextField
          {...params}
          error={false}
          helperText=""
          size="small"
          InputProps={{
            ...params.InputProps,
          }}
        />
      )}
    />
  );
};

// Add this component after CimconPartNumberEditCell
const MaterialDescriptionEditCell = (props: GridRenderEditCellParams) => {
  const [options, setOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchMaterialDescriptions = async () => {
      try {
        const response = await axios.get(
          `${configuration.api_url}item-master-data/`
        );
        console.log("API Response:", response.data);
        setOptions(response.data);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching material descriptions:", err);
        setError(true);
        setLoading(false);
      }
    };
    fetchMaterialDescriptions();
  }, []);

  const handleDescriptionChange = async (_event: any, newValue: any) => {
    try {
      console.log("Selected value:", newValue);

      if (newValue) {
        const selectedItem = options.find(
          (item) => item.description === newValue
        );
        console.log("Selected item:", selectedItem);

        if (selectedItem) {
          const updates = [
            { field: "material_description", value: selectedItem.description },
            {
              field: "cimcon_part_number",
              value: selectedItem.cimcon_part_no || "",
            },
            { field: "mfg_part_number", value: selectedItem.mfg_part_no || "" },
            { field: "make", value: selectedItem.make || "" },
            {
              field: "material_group",
              value: selectedItem.name || "",
            },
            { field: "unit", value: selectedItem.uom || "" },
          ];

          updates.forEach((update) => {
            props.api.setEditCellValue(
              {
                id: props.id,
                field: update.field,
                value: update.value,
              },
              true
            );
          });
        }
      } else {
        const fields = [
          "material_description",
          "cimcon_part_number",
          "mfg_part_number",
          "make",
          "material_group",
          "unit",
        ];

        fields.forEach((field) => {
          props.api.setEditCellValue(
            {
              id: props.id,
              field: field,
              value: "",
            },
            true
          );
        });
      }
    } catch (error) {
      console.error("Error updating fields:", error);
    }
  };

  return (
    <Autocomplete
      fullWidth
      value={props.value || null}
      onChange={handleDescriptionChange}
      options={options.map((item) => item.description)}
      loading={loading}
      freeSolo={false}
      size="small"
      filterOptions={(options, state) => {
        const inputValue = state.inputValue.toLowerCase();
        // Filter to show only options that START WITH the input value
        return options.filter((option) =>
          option.toLowerCase().startsWith(inputValue)
        );
      }}
      isOptionEqualToValue={(option, value) => option === value}
      renderInput={(params) => (
        <TextField
          {...params}
          error={
            error ||
            (props.value &&
              !options.some((item) => item.description === props.value))
          }
          helperText={
            error
              ? "Failed to load options"
              : props.value &&
                !options.some((item) => item.description === props.value)
              ? "Invalid material description"
              : ""
          }
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? (
                  <CircularProgress color="inherit" size={20} />
                ) : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
};

// Add this component for OrderType select cell
const OrderTypeEditCell = (props: GridRenderEditCellParams) => {
  const handleOrderTypeChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newValue = event.target.value;
    props.api.setEditCellValue(
      {
        id: props.id,
        field: "order_type",
        value: newValue,
      },
      true
    );
  };

  const orderTypeOptions = [
    { value: "SUP", label: "Supply" },
    { value: "ITC", label: "ITC" },
    { value: "ONM", label: "O&M" },
    { value: "CON", label: "Contract" },
    { value: "FRE", label: "Freight" },
    { value: "SER", label: "Service" },
  ];

  return (
    <TextField
      select
      fullWidth
      size="small"
      value={props.value || "SUP"}
      onChange={handleOrderTypeChange}
    >
      {orderTypeOptions.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
};

const RequisitionForm: React.FC = () => {
  const [newRowIds, setNewRowIds] = useState<number[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [projectCode, setProjectCode] = useState<string>("");
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [rows, setRows] = useState<GridRowsProp>([]);
  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({});
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error">(
    "success"
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [requisitionDate, setRequisitionDate] = useState<string>(
    dayjs().format("YYYY-MM-DD")
  ); // Default to today's date
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<number | null>(null);
  const [openAddProjectDialog, setOpenAddProjectDialog] =
    useState<boolean>(false); // State for dialog
  const [itemMasterData, setItemMasterData] = useState<any[]>([]);
  const [apiLoading, setApiLoading] = useState<boolean>(false);

  const handleEditRow = (id: number) => {
    setRowModesModel((prevModel) => ({
      ...prevModel,
      [id]: { mode: GridRowModes.Edit },
    }));
    showSnackbar("Editing row " + id, "success");
  };
  useEffect(() => {
    setLoading(true);
    setApiLoading(true);
    console.log("Fetching projects...");
    axios
      .get(`${configuration.api_url}projects/`)
      .then((response) => {
        setLoading(false);
        setApiLoading(false);
        console.log("Projects fetched successfully:", response.data);
        if (Array.isArray(response.data)) {
          // Remove duplicates based on project_code
          const uniqueProjects = Array.from(
            new Map(
              response.data.map((item) => [item.project_code, item])
            ).values()
          );
          setProjects(uniqueProjects);
          console.log("Unique projects set:", uniqueProjects);
        } else {
          setProjects([]);
          console.warn("No projects found in response.");
        }
      })
      .catch((error) => {
        setLoading(false);
        setApiLoading(false);
        console.error("Error fetching projects:", error);
        setProjects([]);
        showSnackbar(
          "Failed to load projects. Please try again later.",
          "error"
        );
      });
  }, [openAddProjectDialog]);

  const handleProjectChange = (event: any, newValue: any) => {
    console.log("Project changed:", newValue);
    setProjectCode(newValue?.code || "");
    setSelectedProject(newValue || null);
    setRows([]); // Reset rows when project changes
  };

  const showSnackbar = (message: string, severity: "success" | "error") => {
    console.log(`Snackbar message: ${message}, Severity: ${severity}`);
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleAddRow = () => {
    const newId =
      rows.length > 0 ? Math.max(...rows.map((row) => row.id)) + 1 : 1;
    const newRow = {
      id: newId,
      item_no: rows.length + 1,
      cimcon_part_number: "",
      mfg_part_number: "",
      material_description: "",
      make: "",
      material_group: "",
      req_qty: 1,
      unit: "",
      required_by_date: dayjs().toDate(),
      remarks: "",
      order_type: "SUP",
      project_code: selectedProject?.project_code,
      client_project_name: selectedProject?.client_project_name,
      prepared_by: selectedProject?.submitted_by,
      approved_by: selectedProject?.approved_by,
      requested_by: selectedProject?.requested_by,
      requisition_date: requisitionDate,
    };

    setRows((prevRows) => [...prevRows, newRow]);
    setRowModesModel((prevModel) => ({
      ...prevModel,
      [newRow.id]: { mode: GridRowModes.Edit },
    }));

    setNewRowIds((prev) => [...prev, newId]);

    setTimeout(() => {
      setNewRowIds((prev) => prev.filter((id) => id !== newId));
    }, 5000);

    showSnackbar("New row added successfully.", "success");
  };

  const validateRow = async (row: any) => {
    try {
      // Debug logs
      console.log("Validating row data:", row);

      // Validate CIMCON Part Number
      const response = await axios.get(`${configuration.api_url}item-master-data/`);
      const validPartNumbers = response.data.map(
        (item: any) => item.cimcon_part_no
      );

      console.log("Valid part numbers:", validPartNumbers);
      console.log("Current part number:", row.cimcon_part_number);
      console.log(
        "Is part number valid?",
        validPartNumbers.includes(row.cimcon_part_number)
      );

      if (!validPartNumbers.includes(row.cimcon_part_number)) {
        showSnackbar(
          `Invalid CIMCON Part Number: ${row.cimcon_part_number}`,
          "error"
        );
        return false;
      }

      // Debug log for other fields
      console.log("Other field values:", {
        mfg: row.mfg_part_number,
        desc: row.material_description,
        make: row.make,
        group: row.material_group,
        unit: row.unit,
        qty: row.req_qty,
      });

      // Validate required fields
      if (
        !row.mfg_part_number?.toString().trim() ||
        !row.material_description?.toString().trim() ||
        !row.make?.toString().trim() ||
        !row.material_group?.toString().trim() ||
        !row.unit?.toString().trim() ||
        typeof row.req_qty !== "number" ||
        row.req_qty <= 0
      ) {
        showSnackbar(
          "Please fill all required fields with valid values",
          "error"
        );
        return false;
      }

      // Inside the validateRow function validation checks:
      if (
        !["SUP", "ITC", "ONM", "CON", "FRE", "SER"].includes(row.order_type)
      ) {
        showSnackbar(
          `Invalid Order Type: ${row.order_type}. Must be one of: Supply, ITC, O&M, Contract, Freight, Service`,
          "error"
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error validating row:", error);
      console.error("Error details:", {
        message: error.message,
        response: error.response?.data,
      });
      showSnackbar("Error validating row data", "error");
      return false;
    }
  };

  const handleSaveClick = (id: GridRowId) => () => {
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.View } });
  };

  const handleRowEditStop = (params: any, event: any) => {
    if (params.reason === "rowFocusOut") {
      event.defaultMuiPrevented = true;
    }
  };
  const processRowUpdate = (newRow: any, oldRow: any) => {
    // Trim input fields and validate them
    const cimconPartNumber = newRow.cimcon_part_number?.trim();
    const materialDescription = newRow.material_description?.trim();
    console.log("Processing row update:", newRow);

    // Check if CIMCON Part Number is empty or less than 14 characters
    if (!cimconPartNumber || cimconPartNumber.length < 14) {
      showSnackbar(
        "CIMCON Part Number must be equal to or greater than 14 characters",
        "error"
      );
      return oldRow; // Prevent update
    }

    // Check for empty material description
    if (!materialDescription) {
      showSnackbar("Material Description is required", "error");
      return oldRow; // Prevent update
    }

    // Check for quantity
    if (typeof newRow.req_qty !== "number" || newRow.req_qty <= 0) {
      showSnackbar("Required Quantity must be a positive number", "error"); // Improved message
      return oldRow; // Prevent update
    }

    // Check for other required fields
    if (!newRow.mfg_part_number?.trim()) {
      showSnackbar("Manufacturing Part Number is required", "error");
      return oldRow; // Prevent update
    }
    if (!newRow.make?.trim()) {
      showSnackbar("Make is required", "error");
      return oldRow; // Prevent update
    }
    if (!newRow.material_group?.trim()) {
      showSnackbar("Material Group is required", "error");
      return oldRow; // Prevent update
    }
    if (!newRow.unit?.trim()) {
      showSnackbar("Unit is required", "error");
      return oldRow; // Prevent update
    }
    if (!newRow.required_by_date) {
      showSnackbar("Required By Date is required", "error");
      return oldRow; // Prevent update
    }

    // Inside the validateRow function validation checks:
    // (Note: Order Type validation is handled during submission, not row update based on current structure)
    // If you want to add it here, uncomment and adjust:
    /*
    if (!["SUP", "ITC", "ONM", "CON", "FRE", "SER"].includes(newRow.order_type?.toString().trim())) {
        showSnackbar(`Invalid Order Type: ${newRow.order_type}. Must be one of: Supply, ITC, O&M, Contract, Freight, Service`, "error");
        return oldRow; // Keep the old values
    }
    */

    // If all validations pass (we would have returned oldRow otherwise)
    setRows((prevRows) =>
      prevRows.map((row) => (row.id === oldRow.id ? { ...newRow } : row))
    );

    console.log("Row updated successfully:", newRow);
    // Optionally show a success snackbar here
    // showSnackbar("Row updated successfully.", "success");
    return newRow; // Allow the update
  };
  const handleSubmit = () => {
    (document.activeElement as HTMLElement)?.blur();
    setApiLoading(true);

    if (!selectedProject?.project_code) {
      showSnackbar("Please select a project before submitting.", "error");
      setApiLoading(false);
      return;
    }

    // Validate all rows before submission
    const invalidRows = rows
      .map((row, index) => {
        const errors: string[] = [];
        console.log("Validating row:", row); // Debug log

        // Check if values exist and are properly formatted
        const cimconPartNumber = row.cimcon_part_number?.toString().trim();
        if (!cimconPartNumber) {
          // Check if CIMCON Part Number is empty or not greater than 14 characters
          errors.push(`Row ${index + 1}: CIMCON Part Number is required`);
        } else if (cimconPartNumber.length < 14) {
          errors.push(
            `Row ${
              index + 1
            }: CIMCON Part Number must be equal to or greater than 14 characters`
          );
        }

        if (!row.mfg_part_number?.toString().trim()) {
          errors.push(`Row ${index + 1}: Missing Manufacturing Part Number`);
        }
        if (!row.material_description?.toString().trim()) {
          errors.push(`Row ${index + 1}: Missing Material Description`);
        }
        if (!row.make?.toString().trim()) {
          errors.push(`Row ${index + 1}: Missing Make`);
        }
        if (!row.material_group?.toString().trim()) {
          errors.push(`Row ${index + 1}: Missing Material Group`);
        }
        if (typeof row.req_qty !== "number" || row.req_qty <= 0) {
          errors.push(`Row ${index + 1}: Invalid Required Quantity`);
        }
        if (!row.unit?.toString().trim()) {
          errors.push(`Row ${index + 1}: Missing Unit`);
        }
        if (!row.required_by_date) {
          errors.push(`Row ${index + 1}: Missing Required By Date`);
        }
        if (
          !["SUP", "ITC", "ONM", "CON", "FRE", "SER"].includes(
            row.order_type?.toString().trim()
          )
        ) {
          errors.push(`Row ${index + 1}: Invalid Order Type`);
        }

        return errors;
      })
      .flat();

    if (invalidRows.length > 0) {
      console.log("Validation errors:", invalidRows); // Debug log
      showSnackbar(invalidRows.join("\n"), "error");
      setApiLoading(false);
      return;
    }

    const newBatchId = `${rows.length + 1}_${selectedProject.project_code}`;
    console.log("New batch ID:", newBatchId);

    // Get current user info from localStorage
    const userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}");
    const currentUserFullName = userInfo.full_name || userInfo.name || 
      (userInfo.first_name && userInfo.last_name 
        ? `${userInfo.first_name} ${userInfo.last_name}`.trim() 
        : userInfo.username || "User");

    const submissionData = {
      batch_id: newBatchId,
      project_code: selectedProject.project_code,
      approved_by: selectedProject.approved_by,
      requested_by: currentUserFullName,
      prepared_by: currentUserFullName,
      user_division_id: userInfo.division,
      requisitions: rows.map((row) => ({
        ...row,
        required_by_date:
          row.required_by_date instanceof Date
            ? dayjs(row.required_by_date).format("YYYY-MM-DD")
            : row.required_by_date,
        requisition_date: requisitionDate,
        req_qty: Number(row.req_qty),
      })),
    };

    console.log("Submitting data:", submissionData);
    console.log("User's division:", userInfo.division);

    axios
      .post(`${configuration.api_url}requisitions/save/`, submissionData)
      .then(() => {
        showSnackbar("Requisitions saved successfully.", "success");
        setRows([]);
        setBatchId(null);
      })
      .catch((error) => {
        console.error("Failed to save requisitions:", error.response?.data);
        const errorMessage =
          error.response?.data?.error ||
          (typeof error.response?.data === "object"
            ? JSON.stringify(error.response?.data)
            : "Failed to save requisitions. Please check your entries and try again.");
        showSnackbar(errorMessage, "error");
      })
      .finally(() => {
        setApiLoading(false);
      });
  };

  const handleDeleteRow = (id: number) => {
    setRowToDelete(id);
    setOpenConfirmDialog(true);
  };

  const handleConfirmDelete = () => {
    if (rowToDelete !== null) {
      setRows((prevRows) => prevRows.filter((row) => row.id !== rowToDelete));
      showSnackbar("Row deleted successfully", "success");
    }
    setOpenConfirmDialog(false);
    setRowToDelete(null);
  };

  const handleCancelDelete = () => {
    setOpenConfirmDialog(false);
    setRowToDelete(null);
  };

  const handleOpenAddProjectDialog = () => {
    setOpenAddProjectDialog(true); // Open the dialog
  };

  const handleCloseAddProjectDialog = () => {
    setOpenAddProjectDialog(false); // Close the dialog
  };

  const handleAddProjectSuccess = () => {
    // Logic to refresh projects or handle success
    console.log("Project added successfully!");
    // Optionally, you can fetch projects again here
  };

  const handleEditClick = (id: GridRowId) => () => {
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.Edit } });
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
      width: 120,
      headerAlign: "center",
      renderCell: (params) => {
        const isInEditMode =
          rowModesModel[params.id]?.mode === GridRowModes.Edit;

        if (isInEditMode) {
          return (
            <Stack direction="row" spacing={0.5}>
              <Tooltip title="Save">
                <IconButton
                  size="small"
                  onClick={() => {
                    const updatedRow = params.row;
                    handleSaveClick(params.id, updatedRow)();
                  }}
                  sx={{ color: "#10b981" }}
                >
                  <SaveIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Cancel">
                <IconButton
                  size="small"
                  onClick={handleCancelClick(params.id)}
                  sx={{ color: "#6b7280" }}
                >
                  <CancelIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton
                  size="small"
                  onClick={() => handleDeleteRow(params.id)}
                  sx={{ color: "#ef4444" }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          );
        }

        return (
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Edit">
              <IconButton
                size="small"
                onClick={handleEditClick(params.id)}
                sx={{ color: "#3b82f6" }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton
                size="small"
                onClick={() => handleDeleteRow(params.id)}
                sx={{ color: "#ef4444" }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        );
      },
    },
    {
      field: "cimcon_part_number",
      headerName: "CIMCON Part Number *",
      editable: true,
      width: 200,
      headerAlign: "center",
      align: "center",
      renderEditCell: (params: GridRenderEditCellParams) => (
        <CimconPartNumberEditCell {...params} itemMasterData={itemMasterData} />
      ),
    },
    {
      field: "mfg_part_number",
      headerName: "Mfg Part Number *",
      editable: true,
      width: 170,
      headerAlign: "center",
      align: "center",
    },
    {
      field: "material_description",
      headerName: "Material Description *",
      editable: true,
      width: 200,
      headerAlign: "center",
      align: "center",
      renderEditCell: (params: GridRenderEditCellParams) => (
        <MaterialDescriptionEditCell {...params} />
      ),
    },
    {
      field: "make",
      headerName: "Make *",
      editable: true,
      width: 100,
      headerAlign: "center",
      align: "center",
    },
    {
      field: "material_group",
      headerName: "Material Group *",
      editable: true,
      width: 140,
      headerAlign: "center",
      align: "center",
    },
    {
      field: "req_qty",
      headerName: "Required Quantity *",
      editable: true,
      width: 150,
      type: "number",
      headerAlign: "center",
      align: "center",
    },
    {
      field: "unit",
      headerName: "UoM*",
      editable: true,
      width: 120,
      headerAlign: "center",
      align: "center",
    },
    {
      field: "required_by_date",
      headerName: "Required By Date *",
      type: "date",
      editable: true,
      width: 200,
      headerAlign: "center",
      align: "center",
    },
    {
      field: "remarks",
      headerName: "Remarks",
      editable: true,
      width: 100,
      headerAlign: "center",
      align: "center",
    },
    {
      field: "order_type",
      headerName: "Order Type *",
      editable: true,
      width: 130,
      headerAlign: "center",
      align: "center",
      renderEditCell: (params: GridRenderEditCellParams) => (
        <OrderTypeEditCell {...params} />
      ),
      renderCell: (params) => {
        const value = params.value || "SUP";
        const labelMap = {
          SUP: "Supply",
          ITC: "ITC",
          ONM: "O&M",
          CON: "Contract",
          FRE: "Freight",
          SER: "Service",
        };
        return (
          <Chip
            label={labelMap[value] || value}
            size="small"
            color="primary"
            variant="outlined"
          />
        );
      },
    },
  ];

  useEffect(() => {
    const fetchItemMasterData = async () => {
      try {
        setLoading(true);
        setApiLoading(true);
        const response = await axios.get(
          `${configuration.api_url}item-master-data/`
        );
        setItemMasterData(response.data);
        setLoading(false);
        setApiLoading(false);
      } catch (error) {
        console.error("Error fetching item master data:", error);
        setLoading(false);
        setApiLoading(false);
      }
    };

    fetchItemMasterData();
  }, []);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f8fafc", p: 3 }}>
      {/* Loading Backdrop */}
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

      {/* Header Section */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h3"
          sx={{
            fontWeight: 800,
            color: "#1e293b",
            mb: 1,
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            backgroundClip: "text",
            textFillColor: "transparent",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Material Requisition
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Create and manage material requisitions efficiently
        </Typography>
        <WorkflowStepper activeStep={0} requisitionDate={requisitionDate} />
      </Box>

      {loading ? (
        <Card elevation={3} sx={{ p: 4, textAlign: "center" }}>
          <CircularProgress size={60} sx={{ mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            Loading Projects...
          </Typography>
        </Card>
      ) : (
        <Container maxWidth="xl" sx={{ px: 0 }}>
          {/* Project Selection Section */}
          <Card
            elevation={3}
            sx={{
              mb: 4,
              borderRadius: 3,
              overflow: "hidden",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            }}
          >
            <CardHeader
              title="Project Selection"
              titleTypographyProps={{
                variant: "h5",
                fontWeight: 600,
                color: "white",
              }}
              avatar={<BusinessIcon sx={{ color: "white", fontSize: 32 }} />}
              sx={{ pb: 1 }}
            />
            <CardContent sx={{ pt: 0 }}>
              <Grid container spacing={3} alignItems="center">
                <Grid item xs={12} md={8}>
                  <Autocomplete
                    options={projects}
                    getOptionLabel={(option) =>
                      `${option.project_code} - ${
                        option.client_project_name || "No Name"
                      }`
                    }
                    onChange={handleProjectChange}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        // label="Select a Project"
                        variant="outlined"
                        fullWidth
                        sx={{
                          bgcolor: "white",
                          borderRadius: 2,
                          "& .MuiOutlinedInput-root": {
                            borderRadius: 2,
                          },
                        }}
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <BusinessIcon
                              sx={{ color: "action.active", mr: 1 }}
                            />
                          ),
                        }}
                      />
                    )}
                    renderOption={(props, option) => (
                      <Box component="li" {...props} sx={{ p: 2 }}>
                        <Box>
                          <Typography variant="subtitle2" fontWeight={600}>
                            {option.project_code}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {option.client_project_name || "No project name"}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    {/* <Typography variant="body2" color="white" fontWeight={500}>
                      Add New Project:
                    </Typography> */}
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={handleOpenAddProjectDialog}
                      sx={{
                        bgcolor: "rgba(255, 255, 255, 0.2)",
                        "&:hover": { bgcolor: "rgba(255, 255, 255, 0.3)" },
                        borderRadius: 2,
                        fontWeight: 600,
                      }}
                    >
                      Add Project
                    </Button>
                  </Stack>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Project Details Section */}
          {selectedProject && (
            <Card elevation={3} sx={{ mb: 4, borderRadius: 3 }}>
              <CardHeader
                title="Project Information"
                titleTypographyProps={{
                  variant: "h6",
                  fontWeight: 600,
                  color: "#1e40af",
                }}
                avatar={<PersonIcon sx={{ color: "#1e40af", fontSize: 28 }} />}
                action={
                  <Chip
                    label="Active Project"
                    color="success"
                    icon={<CheckCircleIcon />}
                    variant="outlined"
                  />
                }
              />
              <CardContent>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      label="Project Code"
                      value={selectedProject.project_code || ""}
                      fullWidth
                      disabled
                      variant="outlined"
                      sx={{
                        "& .MuiInputBase-input": {
                          fontWeight: 600,
                          color: "#1e40af",
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      label="Client Project Name"
                      value={selectedProject.client_project_name || ""}
                      fullWidth
                      disabled
                      variant="outlined"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      label="Approved By"
                      value={selectedProject.approved_by || ""}
                      fullWidth
                      disabled
                      variant="outlined"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      label="Requested By"
                      value={selectedProject.requested_by || ""}
                      fullWidth
                      disabled
                      variant="outlined"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      label="Prepared By"
                      value={selectedProject.submitted_by}
                      fullWidth
                      disabled
                      variant="outlined"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      label="Requisition Date"
                      type="date"
                      value={dayjs(requisitionDate).format("YYYY-MM-DD")}
                      fullWidth
                      onChange={(e) => setRequisitionDate(e.target.value)}
                      variant="outlined"
                      InputProps={{
                        startAdornment: (
                          <CalendarTodayIcon
                            sx={{ color: "action.active", mr: 1 }}
                          />
                        ),
                      }}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )}

          {/* Requisition Items Section */}
          {selectedProject && (
            <Card elevation={3} sx={{ borderRadius: 3 }}>
              <CardHeader
                title={
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <InventoryIcon sx={{ color: "#059669", fontSize: 28 }} />
                    <Box>
                      <Typography variant="h6" fontWeight={600} color="#059669">
                        Requisition Items
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {rows.length} items added
                      </Typography>
                    </Box>
                  </Stack>
                }
                action={
                  <Stack direction="row" spacing={2}>
                    <Button
                      variant="contained"
                      startIcon={<PlaylistAddIcon />}
                      onClick={handleAddRow}
                      sx={{
                        bgcolor: "#059669",
                        "&:hover": { bgcolor: "#047857" },
                        borderRadius: 2,
                        fontWeight: 600,
                      }}
                    >
                      Add Item
                    </Button>
                    {rows.length > 0 && (
                      <Button
                        variant="contained"
                        startIcon={<SaveIcon />}
                        onClick={handleSubmit}
                        sx={{
                          bgcolor: "#3b82f6",
                          "&:hover": { bgcolor: "#2563eb" },
                          borderRadius: 2,
                          fontWeight: 600,
                        }}
                      >
                        Submit Requisition
                      </Button>
                    )}
                  </Stack>
                }
              />

              {/* Instructions */}
              <CardContent sx={{ pt: 0, pb: 2 }}>
                <Alert
                  severity="info"
                  variant="outlined"
                  sx={{
                    mb: 2,
                    borderRadius: 2,
                    "& .MuiAlert-message": {
                      display: "flex",
                      flexDirection: "column",
                      gap: 1,
                    },
                  }}
                >
                  <Typography variant="body2" fontWeight={600}>
                    How to use:
                  </Typography>
                  <Typography variant="body2">
                    • Double-click on any cell to edit • Fill all required
                    fields (marked with *) • Press Enter or click Save icon to
                    save changes
                  </Typography>
                </Alert>

                {/* Data Grid */}
                <Box
                  sx={{
                    height: rows.length > 0 ? "auto" : 400,
                    minHeight: 400,
                    "& .MuiDataGrid-root": {
                      borderRadius: 2,
                      border: "2px solid #e2e8f0",
                    },
                    "& .MuiDataGrid-columnHeaders": {
                      backgroundColor: "#f8fafc",
                      fontWeight: 600,
                      fontSize: "0.875rem",
                    },
                    "& .MuiDataGrid-cell": {
                      borderColor: "#f1f5f9",
                    },
                    "& .highlight-new-row": {
                      backgroundColor: "#dcfce7",
                      animation: "fadeOut 5s ease-in-out",
                    },
                    "@keyframes fadeOut": {
                      "0%": { backgroundColor: "#dcfce7" },
                      "100%": { backgroundColor: "transparent" },
                    },
                  }}
                >
                  <DataGrid
                    rows={rows}
                    columns={columns}
                    pageSize={10}
                    rowsPerPageOptions={[5, 10, 25]}
                    disableSelectionOnClick
                    autoHeight
                    getRowClassName={(params) =>
                      newRowIds.includes(params.id) ? "highlight-new-row" : ""
                    }
                    processRowUpdate={processRowUpdate}
                    onRowEditStop={handleRowEditStop}
                    editMode="row"
                    rowModesModel={rowModesModel}
                    onRowModesModelChange={(newModel) =>
                      setRowModesModel(newModel)
                    }
                    onProcessRowUpdateError={(error) => {
                      console.error("Error updating row:", error);
                      showSnackbar(
                        "Error updating row: " + error.message,
                        "error"
                      );
                    }}
                    components={{
                      NoRowsOverlay: () => (
                        <Box
                          sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            height: "100%",
                            gap: 2,
                          }}
                        >
                          <InventoryIcon
                            sx={{ fontSize: 64, color: "#9ca3af" }}
                          />
                          <Typography variant="h6" color="text.secondary">
                            No items added yet
                          </Typography>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            textAlign="center"
                          >
                            Click "Add Item" to start creating your requisition
                          </Typography>
                        </Box>
                      ),
                    }}
                  />
                </Box>
              </CardContent>
            </Card>
          )}
        </Container>
      )}

      {/* Dialogs and Snackbars */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <AlertComponent
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
          sx={{ borderRadius: 2 }}
        >
          {snackbarMessage}
        </AlertComponent>
      </Snackbar>

      <Dialog
        open={openConfirmDialog}
        onClose={handleCancelDelete}
        PaperProps={{
          sx: { borderRadius: 3 },
        }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <WarningIcon color="warning" />
          Confirm Deletion
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this item? This action cannot be
            undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button
            onClick={handleCancelDelete}
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDelete}
            variant="contained"
            color="error"
            sx={{ borderRadius: 2 }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <AddProjectDialog
        open={openAddProjectDialog}
        onClose={handleCloseAddProjectDialog}
        onSuccess={handleAddProjectSuccess}
      />
    </Box>
  );
};

export default RequisitionForm;
function setRows(arg0: (prevRows: any) => any) {
  throw new Error("Function not implemented.");
}
