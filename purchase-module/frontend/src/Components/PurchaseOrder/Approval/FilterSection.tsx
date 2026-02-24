import React from "react";
import { Box, TextField, IconButton, Tooltip, FormControl, InputLabel, Select, MenuItem } from "@mui/material";
import { DateRangePicker } from "@mui/lab";
import { Clear } from "@mui/icons-material";

interface FilterSectionProps {
  filters: {
    projectCode: string;
    vendorName: string;
    poType?: "" | "domestic" | "overseas";
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
      poType: "",
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
      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel>PO Type</InputLabel>
        <Select
          label="PO Type"
          value={filters.poType || ""}
          onChange={(e) =>
            onFiltersChange({ ...filters, poType: e.target.value })
          }
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="domestic">Domestic</MenuItem>
          <MenuItem value="overseas">Overseas</MenuItem>
        </Select>
      </FormControl>
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
