import React from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Tooltip,
  TableContainer,
  Pagination,
  Divider,
} from "@mui/material";
import { format } from "date-fns";

interface RevisionHistoryProps {
  history: any[];
  title?: string;
}

const RevisionHistory: React.FC<RevisionHistoryProps> = ({
  history,
  title = "Revision History",
}) => {
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(5);

  // Group history items by timestamp (to the minute)
  const groupedHistory = React.useMemo(() => {
    if (!history || history.length === 0) return [];

    // Group records by timestamp to the minute and changed_by
    const groupMap = {};
    history.forEach((record) => {
      const date = new Date(record.changed_at);
      // Format timestamp to minute precision for grouping (YYYY-MM-DD HH:MM)
      const timeKey = `${date.toISOString().slice(0, 16)}_${
        record.changed_by_name || "unknown"
      }`;

      if (!groupMap[timeKey]) {
        groupMap[timeKey] = {
          key: timeKey,
          timestamp: record.changed_at,
          changed_by: record.changed_by_name,
          items: [],
        };
      }

      groupMap[timeKey].items.push(record);
    });

    // Convert to array and sort by timestamp (newest first)
    return Object.values(groupMap).sort(
      (a: any, b: any) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [history]);

  // Add revision numbers to each group
  const revisionsWithNumbers = React.useMemo(() => {
    return groupedHistory.map((group: any, index) => ({
      ...group,
      revision_number: groupedHistory.length - index, // Start from highest number (newest = highest)
    }));
  }, [groupedHistory]);

  // Handle pagination for the groups
  const displayedGroups = React.useMemo(() => {
    const startIndex = page * rowsPerPage;
    return revisionsWithNumbers.slice(startIndex, startIndex + rowsPerPage);
  }, [revisionsWithNumbers, page, rowsPerPage]);

  const handleChangePage = (
    event: React.ChangeEvent<unknown>,
    newPage: number
  ) => {
    setPage(newPage - 1);
  };

  return (
    <Box sx={{ width: "100%" }}>
      <Typography
        variant="h6"
        gutterBottom
        sx={{
          px: 2,
          pt: 2,
          fontWeight: 600,
          color: "#2c3e50",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>{title}</span>
        <span
          style={{ fontSize: "0.8rem", fontWeight: "normal", color: "#718096" }}
        >
          {revisionsWithNumbers.length} revision
          {revisionsWithNumbers.length !== 1 ? "s" : ""}
        </span>
      </Typography>

      <TableContainer sx={{ maxHeight: 400 }}>
        {displayedGroups.map((group, groupIndex) => (
          <Box key={group.key} sx={{ mb: 3 }}>
            {/* Revision header */}
            <Box
              sx={{
                p: 1.5,
                backgroundColor: "rgba(33, 150, 243, 0.08)",
                borderRadius: "4px 4px 0 0",
                border: "1px solid rgba(224, 224, 224, 1)",
                borderBottom: "none",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <Typography variant="subtitle1" fontWeight="600">
                Revision {group.revision_number}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  {format(new Date(group.timestamp), "dd/MM/yyyy HH:mm")} by{" "}
                  {group.changed_by || "Unknown"}
                </Typography>
                <Chip
                  label={`${group.items.length} change${
                    group.items.length !== 1 ? "s" : ""
                  }`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              </Box>
            </Box>

            {/* Revision content */}
            <Table
              size="small"
              sx={{
                border: "1px solid rgba(224, 224, 224, 1)",
                borderRadius: "0 0 4px 4px",
                overflow: "hidden",
                mb: 2,
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      bgcolor: "rgba(33, 150, 243, 0.05)",
                      minWidth: 100,
                    }}
                  >
                    Field
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      bgcolor: "rgba(33, 150, 243, 0.05)",
                      minWidth: 120,
                    }}
                  >
                    Old Value
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      bgcolor: "rgba(33, 150, 243, 0.05)",
                      minWidth: 120,
                    }}
                  >
                    New Value
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      bgcolor: "rgba(33, 150, 243, 0.05)",
                      minWidth: 100,
                    }}
                  >
                    Status
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      bgcolor: "rgba(33, 150, 243, 0.05)",
                      minWidth: 120,
                    }}
                  >
                    Approved By
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      bgcolor: "rgba(33, 150, 243, 0.05)",
                      minWidth: 150,
                    }}
                  >
                    Remarks
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {group.items.map((record, index) => (
                  <TableRow key={`${group.key}-${index}`} hover>
                    <TableCell>{record.field_name}</TableCell>
                    <TableCell>
                      <Tooltip
                        title={record.old_value || ""}
                        arrow
                        placement="top"
                      >
                        <Box
                          sx={{
                            color: "error.main",
                            maxWidth: "120px",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {record.old_value || "-"}
                        </Box>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Tooltip
                        title={record.new_value || ""}
                        arrow
                        placement="top"
                      >
                        <Box
                          sx={{
                            color: "success.main",
                            maxWidth: "120px",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {record.new_value || "-"}
                        </Box>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={record.approval_status ? "Approved" : "Pending"}
                        color={record.approval_status ? "success" : "warning"}
                        size="small"
                        sx={{ minWidth: "80px" }}
                      />
                    </TableCell>
                    <TableCell>{record.approved_by_name || "-"}</TableCell>
                    <TableCell>
                      <Tooltip
                        title={record.remarks || "-"}
                        arrow
                        placement="top"
                      >
                        <Box
                          sx={{
                            maxWidth: "150px",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {record.remarks || "-"}
                        </Box>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ))}

        {revisionsWithNumbers.length === 0 && (
          <Box sx={{ p: 3, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              No revision history available
            </Typography>
          </Box>
        )}
      </TableContainer>

      {revisionsWithNumbers.length > rowsPerPage && (
        <Box sx={{ display: "flex", justifyContent: "center", pt: 2, pb: 1 }}>
          <Pagination
            count={Math.ceil(revisionsWithNumbers.length / rowsPerPage)}
            page={page + 1}
            onChange={handleChangePage}
            color="primary"
            size="small"
          />
        </Box>
      )}
    </Box>
  );
};

export default RevisionHistory;
