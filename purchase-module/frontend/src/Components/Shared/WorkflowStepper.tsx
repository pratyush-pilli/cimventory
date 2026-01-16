import React from "react";
import { Stepper, Step, StepLabel, Box, Typography } from "@mui/material";

interface WorkflowStepperProps {
  activeStep: number;
  requisitionDate?: string;
  approvalDate?: string;
  verificationDate?: string;
}

const WorkflowStepper: React.FC<WorkflowStepperProps> = ({
  activeStep,
  requisitionDate,
  approvalDate,
  verificationDate,
}) => {
  const steps = [
    "Requisition Created",
    "Pending Approval",
    "Approved",
    "Stock Verification",
    "Verification Complete",
  ];

  return (
    <Box sx={{ width: "100%", mb: 4 }}>
      <Stepper
        activeStep={activeStep}
        sx={{
          "& .MuiStepLabel-root .Mui-completed": {
            color: "success.main",
          },
          "& .MuiStepLabel-root .Mui-active": {
            color: "primary.main",
          },
        }}
      >
        {steps.map((label, index) => (
          <Step key={label}>
            <StepLabel>
              {label}
              {index === 0 && requisitionDate && (
                <Typography
                  variant="caption"
                  sx={{ display: "block", color: "text.secondary" }}
                >
                  {/* {requisitionDate} */}
                </Typography>
              )}
              {index === 2 && approvalDate && (
                <Typography
                  variant="caption"
                  sx={{ display: "block", color: "text.secondary" }}
                >
                  {/* {approvalDate} */}
                </Typography>
              )}
              {index === 4 && verificationDate && (
                <Typography
                  variant="caption"
                  sx={{ display: "block", color: "text.secondary" }}
                >
                  {/* {verificationDate} */}
                </Typography>
              )}
            </StepLabel>
          </Step>
        ))}
      </Stepper>
    </Box>
  );
};

export default WorkflowStepper;
