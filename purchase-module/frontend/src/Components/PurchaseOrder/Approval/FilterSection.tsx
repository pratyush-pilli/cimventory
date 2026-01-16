import React from "react";
import { Box, TextField, IconButton, Tooltip } from "@mui/material";
import { DateRangePicker } from "@mui/lab";
import { Clear } from "@mui/icons-material";

interface FilterSectionProps {
  filters: {
    projectCode: string;
    vendorName: string;
    dateRange: [Date | null, Date | null];
  };
  onFiltersChange: (filters: any) => void;
}

const FilterSection: React.FC<FilterSectionProps> = ({
  filters,
  onFiltersChange,
}) => {
  const handleClearFilters = () => {
    onFiltersChange({
      projectCode: "",
      vendorName: "",
      dateRange: [null, null],
    });
  };

  return (
    <Box className="filter-section">
      <TextField
        label="Project Code"
        value={filters.projectCode}
        onChange={(e) =>
          onFiltersChange({ ...filters, projectCode: e.target.value })
        }
        variant="outlined"
        size="small"
      />
      <TextField
        label="Vendor Name"
        value={filters.vendorName}
        onChange={(e) =>
          onFiltersChange({ ...filters, vendorName: e.target.value })
        }
        variant="outlined"
        size="small"
      />
      <DateRangePicker
        startText="From Date"
        endText="To Date"
        value={filters.dateRange}
        onChange={(newValue) =>
          onFiltersChange({ ...filters, dateRange: newValue })
        }
      />
      <Tooltip title="Clear Filters">
        <IconButton onClick={handleClearFilters}>
          <Clear />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

export default FilterSection;
