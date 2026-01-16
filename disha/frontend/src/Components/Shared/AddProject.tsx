import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  TextField,
  Autocomplete,
  Alert,
  Slide,
} from "@mui/material";
import { Close, Refresh } from "@mui/icons-material";
import axios from "axios";
import configuration from "../../configuration";
import { useSnackbar } from "notistack";

interface AddProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void; // Callback when a project is successfully added
}

const AddProjectDialog: React.FC<AddProjectDialogProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const initialProjectInfo = {
    project_code: "",
    client_project_name: "",
    approved_by: "", // This will be set based on the approver's name
    submitted_by: "", // This will be set based on userInfo
    requested_by: "",
    bill_to: "",
    ship_to: "",
    division: "", // Add division field
  };

  const [projectInfo, setProjectInfo] = useState(initialProjectInfo);

  const [divisionUsers, setDivisionUsers] = useState<
    Array<{
      id: number;
      username: string;
      name: string; // Use 'name' instead of 'full_name'
      role: string;
      approver_name: string; // This is the approver's name
    }>
  >([]);
  const [requisitors, setRequisitors] = useState<
    Array<{ id: number; name: string }>
  >([]);
  const [alert, setAlert] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);

  const { enqueueSnackbar } = useSnackbar();

  // Function to handle form clearing
  const handleClear = () => {
    // Save the automatically populated fields
    const { approved_by, submitted_by, division } = projectInfo;

    // Reset to initial state but preserve auto-populated fields
    setProjectInfo({
      ...initialProjectInfo,
      approved_by,
      submitted_by,
      division,
    });

    // Show notification
    enqueueSnackbar("Form has been cleared", { variant: "info" });
  };

  useEffect(() => {
    const fetchDivisionUsers = async () => {
      const divisionId = localStorage.getItem("division");
      if (!divisionId) {
        setAlert({
          type: "error",
          message:
            "Session expired or missing information. Please log in again.",
        });
        return;
      }

      try {
        const response = await axios.get(
          `${configuration.api_url}/api/divisions/${divisionId}/users/`,
          { withCredentials: true }
        );

        const users = response.data;
        setDivisionUsers(users);

        // Find the single approver
        const approverUser = users.find((user) => user.role === "Approver");
        if (approverUser) {
          console.log("Approved By set to:", approverUser.approver_name); // Log the approver's name
          // Only set approved_by if it is currently empty
          setProjectInfo((prev) => ({
            ...prev,
            approved_by: prev.approved_by || approverUser.approver_name,
          }));
        } else {
          console.warn("No approver found.");
        }

        const requisitorsList = users.filter(
          (user) => user.role === "Requisitor"
        );
        setRequisitors(requisitorsList);
      } catch (error) {
        setAlert({
          type: "error",
          message: "Unable to fetch division users. Please try again later.",
        });
      }
    };

    if (open) {
      fetchDivisionUsers();

      // Fetch user details from local storage
      const userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}");

      if (userInfo) {
        // Add debug logging to see the actual structure
        console.log("User Info detailed properties:", userInfo);

        // Try different properties to construct the name
        const submittedBy =
          userInfo.full_name ||
          (userInfo.first_name && userInfo.last_name
            ? `${userInfo.first_name} ${userInfo.last_name}`.trim()
            : userInfo.username || "");

        setProjectInfo((prev) => ({
          ...prev,
          submitted_by: submittedBy,
          approved_by: userInfo.approver_name || prev.approved_by,
          division: userInfo.division || "",
        }));
        console.log("User Info from local storage:", userInfo);
        console.log("Division ID from local storage:", userInfo.division);
      }
    }
  }, [open]);

  const createProjectCode = async (projectData: {
    projectId: number;
    projectCode: string;
    projectName: string;
  }) => {
    try {
      const response = await axios.post(
        `${configuration.api_url}project-codes/`,
        {
          code: projectData.projectCode,
          name: projectData.projectName,
        },
        { withCredentials: true }
      );
      if (response.status === 201) {
        enqueueSnackbar("Project code created successfully", {
          variant: "success",
        });
      }
    } catch (error) {
      console.error("Error creating project code:", error);
      enqueueSnackbar("Failed to create project code", { variant: "error" });
    }
  };

  const handleSubmit = async () => {
    setAlert(null);

    console.log("Project Info before submission:", projectInfo);

    // Validate required fields
    if (
      !projectInfo.project_code ||
      !projectInfo.client_project_name ||
      !projectInfo.approved_by ||
      !projectInfo.submitted_by ||
      !projectInfo.requested_by ||
      !projectInfo.bill_to ||
      !projectInfo.ship_to
    ) {
      setAlert({
        type: "error",
        message: "Please fill out all required fields.",
      });
      return;
    }

    try {
      // Create project
      const response = await axios.post(
        `${configuration.api_url}/create-project/`,
        {
          project_code: projectInfo.project_code,
          client_project_name: projectInfo.client_project_name,
          approved_by: projectInfo.approved_by,
          submitted_by: projectInfo.submitted_by,
          requested_by: projectInfo.requested_by,
          division: projectInfo.division,
          bill_to: projectInfo.bill_to,
          ship_to: projectInfo.ship_to,
        },
        { withCredentials: true }
      );
      console.log("Response from backend:", response.data);

      // Create project code using the actual project code
      await createProjectCode({
        projectId: response.data.id,
        projectCode: projectInfo.project_code,
        projectName: projectInfo.client_project_name,
      });

      setAlert({
        type: "success",
        message: "Project created successfully!",
      });
      setTimeout(() => {
        onClose();
        onSuccess();
      }, 2000);
    } catch (error) {
      console.error("Error during project creation:", error);
      setAlert({
        type: "error",
        message: "Failed to create project. Please try again.",
      });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      TransitionComponent={Slide}
      TransitionProps={{ direction: "up", timeout: 500 }}
    >
      <DialogTitle>
        Add New Project
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ position: "absolute", right: 8, top: 8 }}
        >
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {alert && <Alert severity={alert.type}>{alert.message}</Alert>}
        {[
          { label: "Project Code", name: "project_code" },
          { label: "Client/Project Name", name: "client_project_name" },
          {
            label: "Bill To Address",
            name: "bill_to",
            type: "textarea",
            required: true,
          },
          {
            label: "Ship To Address",
            name: "ship_to",
            type: "textarea",
            required: true,
          },
          { label: "Requested By", name: "requested_by" },
        ].map((field) => (
          <TextField
            key={field.name}
            label={field.label}
            name={field.name}
            value={projectInfo[field.name]}
            onChange={(e) =>
              setProjectInfo({ ...projectInfo, [field.name]: e.target.value })
            }
            required
            fullWidth
            margin="normal"
            multiline={field.type === "textarea"}
            rows={field.type === "textarea" ? 4 : 1}
            error={!projectInfo[field.name] && field.required}
            helperText={
              !projectInfo[field.name] && field.required
                ? `${field.label} is required`
                : ""
            }
          />
        ))}
        <TextField
          label="Approved By"
          value={projectInfo.approved_by}
          disabled
          fullWidth
          margin="normal"
        />
        <TextField
          label="Submitted By"
          value={projectInfo.submitted_by}
          disabled
          fullWidth
          margin="normal"
        />
      </DialogContent>
      <DialogActions>
        <Button
          onClick={handleClear}
          color="secondary"
          startIcon={<Refresh />}
          sx={{ marginRight: "auto" }} // Position the clear button on the left
        >
          Clear Form
        </Button>
        <Button onClick={onClose} color="secondary">
          Cancel
        </Button>
        <Button onClick={handleSubmit} color="primary" variant="contained">
          Submit
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddProjectDialog;
