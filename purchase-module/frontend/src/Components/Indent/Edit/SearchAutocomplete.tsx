import React, { useState, useEffect } from "react";
import { Autocomplete, TextField } from "@mui/material";
import axios from "axios";
import configuration from "../../../configuration";

interface Project {
  project_code: string;
}

interface SearchAutocompleteProps {
  onSelect: (projectCode: string) => void;
}

const SearchAutocomplete: React.FC<SearchAutocompleteProps> = ({
  onSelect,
}) => {
  const [options, setOptions] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProjectCodes = async () => {
      setLoading(true);
      try {
        const response = await axios.get(
          `${configuration.api_url}/requisitions/`
        );

        // Log the response to see its structure
        console.log(response.data);

        // Extract project codes from requisitions
        const uniqueProjectCodes = Array.from(
          new Set(
            response.data.map(
              (requisition: { project_code: string }) =>
                requisition.project_code
            )
          )
        ).map((code) => ({ project_code: code }));

        // Log the unique project codes to verify
        console.log(uniqueProjectCodes);

        setOptions(uniqueProjectCodes);
      } catch (error) {
        console.error("Error fetching project codes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjectCodes();
  }, []);

  return (
    <Autocomplete
      options={options}
      getOptionLabel={(option) => option.project_code || ""}
      onChange={(event, value) => value && onSelect(value.project_code)}
      loading={loading}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Search Project Code"
          variant="outlined"
          InputProps={{
            ...params.InputProps,
            sx: {
              borderRadius: "12px",
              backgroundColor: "rgba(255, 255, 255, 0.8)",
              "&:hover": {
                backgroundColor: "rgba(255, 255, 255, 0.9)",
              },
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "rgba(33, 150, 243, 0.2)",
              },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                borderColor: "#2196f3",
              },
            },
          }}
          sx={{
            width: "100%",
            maxWidth: "600px",
            margin: "0 auto",
          }}
        />
      )}
      sx={{
        "& .MuiAutocomplete-option": {
          padding: "12px",
          "&:hover": {
            backgroundColor: "rgba(33, 150, 243, 0.1)",
          },
        },
      }}
    />
  );
};

export default SearchAutocomplete;
