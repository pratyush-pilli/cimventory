"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  Box,
  Typography,
  Grid,
  Table,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
  TableContainer,
  Button,
  Divider,
  Paper,
} from "@mui/material";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// Updated print styles to handle multiple pages correctly
const printStyles = `
  @media print {
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
    
    body {
      margin: 0;
      padding: 0;
    }
    
    body * {
      visibility: hidden;
    }
    
    .print-container, .print-container * {
      visibility: visible;
    }
    
    .no-print {
      display: none !important;
    }
    
    /* Proper page break handling */
    .page-break {
      page-break-before: always;
      height: 0;
      margin: 0;
      padding: 0;
    }
    
    /* Ensure T&C section prints properly */
    .tc-section {
      page-break-inside: avoid;
    }
    
    .tc-section ol li {
      page-break-inside: avoid;
    }
  }
`;

const POPreviewPrint = () => {
  const { id } = useParams();
  const [poData, setPOData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tcContent, setTcContent] = useState("");
  const contentRef = useRef(null);

  useEffect(() => {
    // Get data from localStorage
    const data = localStorage.getItem(`po_data_${id}`);
    if (data) {
      try {
        const parsedData = JSON.parse(data);
        setPOData(parsedData);
      } catch (error) {
        console.error("Error parsing PO data:", error);
      }
    }
    setLoading(false);

    // Initialize T&C content directly as state
    setTcContent(`
    <ol style="padding-left: 20px; margin-top: 0;">
      <li>
        <strong>PO ACCEPTANCE:</strong> Acceptance of the purchase order shall be given by the Supplier in writing within 3 days of receipt of this purchase order, failing which the Supplier will be deemed to have accepted the order at the stated terms & conditions.
      </li>
      <li>
        <strong>PRICE / RATE:</strong> The prices/rates are FIRM and FIXED till completion of the order, and no price escalation is allowed under any circumstances. The rates mentioned in the Purchase Order shall remain valid till the satisfactory completion of the agreed scope of supply.
      </li>
      <li>
        <strong>APPLICABLE TAXES:</strong> GST @ 18% as applicable. TCS inclusion in the tax invoice is not applicable. However, we shall deduct TDS @ 0.1% on the tax invoices / BOE shall be as applicable
      </li>
      <li>
        <strong>PACKING / FORWARDING:</strong> Goods supplied against this purchase order shall be properly packed in line with best industry practices to ensure safe transport by SEA / AIR / SURFACE / RAIL to the place stipulated in this order. No charges shall be paid for packing. The material shall be packed carefully to prevent damage during transit. Prices are inclusive of Packing & Forwarding.
      </li>
      <li>
        <strong>LABELS / MARKING:</strong> Each product's details with serial number with QR Code shall be mentioned on every product and box. Any special mark/embossed required for the particular project shall be confirmed with the buyer before manufacturing starts (In that case, printed labels shall not be acceptable). All labels/markings should be designed as per the approved QAP.
      </li>
      <li>
        <strong>GUARANTEE/WARRANTY:</strong> 18 months from the date of commissioning or 24 months from the date of last supply, whichever is earlier. Any complaint reported within the warranty period will be addressed and resolved within 24 hours from the time of complaint was raised. Any remote online support will be provided within 24 hours for calibration, testing, site installation, and commissioning as required. Any part found defective during this period as a consequence of bad design, manufacturing, or workmanship should be replaced, free of cost, by you. In case you fail to carry out repairs/replacements, we shall carry out the same at your risk & cost. The repaired/replaced part shall be repaired/replaced free of cost at the site. The acceptance of material at the site does not relieve the vendor of his obligation under this clause. The spares and service costs shall be at actual after the warranty period.
      </li>
      <li>
        <strong>INSPECTION OF GOODS:</strong> The material shall be inspected by the TPI agencies (Assigned by CIMCON / End Customer), and the TPI inspection report, along with the release note, shall be submitted to the buyer for dispatch clearance. The expense for the TPI inspections shall be borne by the supplier (If agreed during order finalization). The Supplier shall raise a formal Inspection call in the Buyer's format at least 5 days in advance. The Buyer reserves the right to inspect goods at the point of assembly and/or delivery. If the goods manufactured do not follow the approved drawings and specifications and as per the purchase order, the Buyer reserves the right to reject the goods in whole or in part. In such an event, the Buyer shall be free to buy the goods from any other source, and the Supplier shall be liable to reimburse the Buyer for any additional cost incurred in doing so and refund all the payments that have been made for the rejected material.
      </li>
      <li>
        <strong>LIQUATED DAMAGES:</strong> In case the supplier fails to deliver the goods within the agreed days, the purchaser may deduct liquidated damages @ 0.1% of the invoice value for every day of delay for an unexecuted portion of the supply. The maximum limit of such deduction will be 10% of the contract price. Such penalty shall be recovered from the balance/s payable to the Supplier or shall be adjusted against security instruments if so available with the Purchaser.
      </li>
      <li>
        <strong>FORCE MAJEURE:</strong> The Supplier shall be under no liability for failure to deliver and the Buyer for failure to accept delivery of goods or any part thereof when such failure is due to natural events such as fire, earthquakes, floods, strikes, lock-outs, transportation, embargoes, act of God, State enemies, or any other causes whatsoever beyond the control of the Supplier or Buyer.
      </li>
      <li>
        <strong>EXCESS SUPPLIES:</strong> Material must not be more than quantity ordered. The Buyer assumes no obligation concerning such excess quantity. The Supplier must remove such excess supplies at his own risk and cost.
      </li>
      <li>
        <strong>INDEMNITY:</strong> CIMCON and its associated companies, subsidiaries, and its Directors, personnel, officers, and employees shall be indemnified and held harmless by the supplier for and against any liabilities, losses, damages, claims, costs and expenses, interest and penalties (including without limitation, attorney fees and expenses) suffered or incurred by CIMCON arising out of resulting from the breach of any representation, warranty, covenant or obligation made by the supplier in the PO.
      </li>
      <li>
        <strong>ACCEPTANCE OF GOODS:</strong> Acceptance of any of the goods shall not discharge the Supplier from liability for other legal remedy for any breach of any condition or warranty contained herein or implied by law and if after accepting the goods or any of them any defects therein either in material, workmanship or otherwise become known to the Buyer and such defects amount to a breach of any condition or warranty hereunder or implied by law, the Buyer shall forthwith notify the Supplier of such defects and shall (in addition to any other rights or remedies that the Buyer may possess) be entitled to reject the defective goods and hold the same at the Suppliers risk. The Supplier shall be responsible and be liable to replace or to repair at the option of the Buyer, free of cost, goods supplied under this order or any part thereof if any defect in the composition or substance material workmanship or process of manufacture or the design of the goods is brought to the notice of the Supplier within 24 calendar months from the date of delivery.
      </li>
      <li>
        <strong>REMOVAL OR REJECTED GOODS:</strong> The Supplier shall remove the rejected goods from the Buyer's warehouse or site at his / their own cost within 15 days from the date of intimation from the Buyer of their refusal to accept the goods. The Buyer shall not be responsible for or be held liable for any loss or deterioration of the rejected goods. The Supplier shall pay to Buyer reasonable storage charges for such rejected goods for the period exceeding 15 days as aforesaid.
      </li>
      <li>
        <strong>DISPATCH INSTRUCTIONS:</strong> Buyer shall issue Dispatch Instructions (DI) to Supplier after successful inspection/testing and on receipt of formal dispatch clearance from the end client upon submitting the TPI inspection report and the release note. Supplier shall prepare and submit the dispatch documents strictly following DI. The Supplier shall dispatch the material only after getting written dispatch clearance along with DI from the Buyer. The material shall be delivered to the address mentioned in the DI.
      </li>
      <li>
        <strong>INSTALLATION:</strong> The installation and commissioning are in the scope of the supplier (If agreed during order finalization). The buyer is not responsible for any materials/manpower/logistics for installation. The installation and commissioning shall be completed within a week after giving the clearance from the site (Client). Once installation and commissioning are completed the supplier shall sign a User Acceptance Document (UAD) between the supplier and the buyer to hand over the site.
      </li>
      <li>
        <strong>QUALITY:</strong> The material shall be manufactured strictly as per approved drawings and Guaranteed Technical Particulars (GTPs) and correspond with the description or the sample or the original specifications thereof in all details. Otherwise, the same shall be liable to be rejected by the Buyer and the Supplier shall be deemed to have delivered the wrong goods according to the contract. The Buyer's decision in the matter of Quality will be final and binding. Besides the Supplier shall be liable for the "Latent Defects" & shall stand a guarantee for the replacement of any parts/materials/services for a further period as per tender from the end of the guarantee period. Spares and service costs after the Defective Liability Period (warranty Period) to be provided.
      </li>
      <li>
        <strong>CANCELLATION / AMENDMENT:</strong> The Buyer reserves the right to cancel or amend this order or any part thereof without assigning any reason.
      </li>
      <li>
        <strong>CONFIDENTIALITY:</strong> Supplier shall maintain strict confidentiality in respect of the information gathered from CIMCON and the contract. In case it becomes necessary to disclose such information to any third party, then written confirmation shall be obtained by the supplier from CIMCON. Suppliers cannot claim CIMCON as customers in any media or verbal. Suppliers do not get marketing rights for CIMCON products. There should not be any Chinese language in any product, module, PCB, label, manual, box, or package. CIMCON will provide the design of customized labels. The Supplier agrees that he/they will not use, sell, loan, or publicize any of the specifications, blueprints, or designs, supplied or paid for by the Buyer for fulfilment of this order without prior written consent from the Buyer.
      </li>
      <li>
        <strong>DISPUTE RESOLUTION:</strong> Any dispute and claims between the Parties to the Agreement arising out of or incidental thereto or in connection with the Agreement, or the breach, or Invalidity thereof, or its performance shall be referred to the Director of CIMCON, and decision of Director of CIMCON shall be final and binding. No Arbitration is allowed under this agreement.
      </li>
      <li>
        <strong>JURISDICTION OF COURTS:</strong> The Law Courts at Ahmedabad shall have exclusive jurisdiction in the matter arising under this agreement.
      </li>
      <li>
        <strong>COMPLETENESS:</strong> Supplier confirms that the complete requirements as contained in the Drawings / Specifications / Clarifications submitted are understood and all items of the Project whether specifically mentioned or not in Technical Specification, are necessary for completeness, and for safe and efficient operation, maintenance and guaranteed performance shall be supplied by the Supplier at no extra cost.
      </li>
      <li>
        <strong>COMPLIANCE:</strong> Goods and services shall conform to the requirements of the contract and shall be fit for purpose. They shall be made or performed following good engineering practices and all applicable standards and legislation. Goods shall be delivered complete with all instructions, warnings, and other data necessary for safe and proper operation. Goods or services which do not comply with all of the above shall be considered to be defective. If for any reason the Supplier is uncertain as to whether the goods or services to be supplied by it will comply with any of the above, it must promptly and before dispatch inform the Buyer in writing with full details of the possible non-compliance for consideration. Written acceptance or rejection of the Supplier's application will then be provided by the Buyer in as timely a manner as possible.
      </li>
      <li>
        <strong>MANUFACTURING CLEARANCE:</strong> The Supplier shall start the manufacturing of material only after getting a written Manufacturing Clearance (MC) from the Buyer after successful validation of the samples and satisfactory feedback from the manufacturing factory visit. If the supplier starts the manufacturing without the buyer's written clearance, the buyer shall not be responsible for any loss due to the cancellation of the order. The quantity cleared in MC shall only be manufactured by the Supplier. Any material manufactured without getting the MC from the Buyer shall be rejected.
      </li>
      <li>
        <strong>QUANTITY VARIATION:</strong> The Buyer reserves the right to change the quantity during the execution of the contract. The unit prices mentioned in the purchase order shall be applicable for change in quantity variation as per site required overall for additional / deletion quantity during the tenancy of the contract.
      </li>
      <li>
        <strong>ANTI-CORRUPTION POLICY:</strong> The purchaser has zero tolerance concerning corruption in any shape. Suppliers are advised to adhere in total and do nothing of the sort which could lead to the tarnishing of their image, blacklisting of the Seller including forfeiting of payable dues. Influencing employees for any kind of favor through unethical means shall not be tolerated by the management of CIMCON
      </li>
      <li>
        <strong>CHECKLIST FOR SUBMISSION OF INVOICES ALONG WITH DOCUMENTATION AFTER DISPATCH OF MATERIALS</strong>
        <ol type="i" style="margin-top: 5px; padding-left: 30px;">
          <li>TPI Inspection reports and release note</li>
          <li>Serial number list of all items</li>
          <li>Packing list identifying contents of each shipment</li>
          <li>Evidence of dispatch (LR Copy)</li>
          <li>E-way Bill</li>
          <li>E-Invoice with Digital Signature</li>
          <li>Dispatch Instruction issued by CIMCON</li>
          <li>Manufacturer's/Contractor's guarantee certificate of Quality</li>
          <li>Material Test certificate</li>
        </ol>
      </li>
    </ol>
    `);
  }, [id]);

  const handleTcChange = (e) => {
    setTcContent(e.target.innerHTML);
  };

  // Function to download the document as PDF
  const downloadAsPDF = () => {
    if (!poData) return;

    try {
      setLoading(true);

      // Hide the buttons temporarily
      const buttons = document.querySelector(".no-print");
      if (buttons) buttons.style.display = "none";

      // Create a new PDF document
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      // A4 dimensions
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 10;

      // Get all pages
      const pages = document.querySelectorAll(
        ".print-container > .print-container"
      );

      // Process each page separately
      let pagePromises = Array.from(pages).map((page, index) => {
        return html2canvas(page, {
          scale: 2, // Higher scale for better quality
          useCORS: true,
          allowTaint: true,
          logging: false,
          windowWidth: page.scrollWidth,
          windowHeight: page.scrollHeight,
        }).then((canvas) => {
          // Add a new page for all pages after the first one
          if (index > 0) pdf.addPage();

          // Calculate scaling to fit the page
          const imgData = canvas.toDataURL("image/jpeg", 0.95);
          const pageRatio = canvas.width / canvas.height;
          const pdfRatio = (pageWidth - 2 * margin) / (pageHeight - 2 * margin);

          let imgWidth, imgHeight;

          if (pageRatio >= pdfRatio) {
            // Width constrained
            imgWidth = pageWidth - 2 * margin;
            imgHeight = imgWidth / pageRatio;
          } else {
            // Height constrained
            imgHeight = pageHeight - 2 * margin;
            imgWidth = imgHeight * pageRatio;
          }

          // Center the image on the page
          const xOffset = margin + (pageWidth - 2 * margin - imgWidth) / 2;
          const yOffset = margin;

          // Add the image to the PDF
          pdf.addImage(
            imgData,
            "JPEG",
            xOffset,
            yOffset,
            imgWidth,
            imgHeight,
            undefined,
            "FAST"
          );
        });
      });

      // When all pages are processed, save the PDF
      Promise.all(pagePromises).then(() => {
        pdf.save(`PurchaseOrder_${poData.poDetails.poNumber}.pdf`);

        // Restore buttons
        if (buttons) buttons.style.display = "block";
        setLoading(false);
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      // Restore buttons
      const buttons = document.querySelector(".no-print");
      if (buttons) buttons.style.display = "block";
      setLoading(false);
      alert(
        "There was an error creating the PDF. Please try using Print instead."
      );
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        Loading...
      </Box>
    );
  }

  if (!poData) {
    return (
      <Box sx={{ p: 4 }}>No PO data found. Please go back and try again.</Box>
    );
  }

  // Format date properly
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const formattedPoDate = formatDate(poData.poDetails.poDate);

  return (
    <div ref={contentRef} id="contentRef">
      {/* Add print styles */}
      <style>{printStyles}</style>

      {/* Action buttons */}
      <Box className="no-print" sx={{ mb: 2 }}>
        <Button onClick={() => window.print()}>Print</Button>
        <Button
          variant="contained"
          color="primary"
          onClick={downloadAsPDF}
          sx={{ ml: 1 }}
        >
          Download as PDF
        </Button>
        <Button
          variant="outlined"
          onClick={() => window.close()}
          sx={{ ml: 1 }}
        >
          Close
        </Button>
      </Box>
      <Box className="print-container">
        {/* First page - Purchase Order */}
        <Paper
          className="print-container first-page"
          elevation={0}
          sx={{
            width: "210mm",
            minHeight: "297mm",
            margin: "0 auto",
            padding: 0,
            border: "1px solid black",
            fontFamily: "Arial, sans-serif",
            overflow: "hidden",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            breakAfter: "page",
            position: "relative",
          }}
        >
          {/* Header */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              p: 1,
              borderBottom: "1px solid black",
            }}
          >
            <img
              src="/header.png"
              alt="CIMCON Software (India) Pvt. Ltd."
              style={{ width: "100%" }}
            />
          </Box>

          {/* PO Title */}
          <Box sx={{ textAlign: "center", py: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: "bold" }}>
              PURCHASE ORDER
            </Typography>
          </Box>

          {/* Main content grid */}
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <Grid
              container
              sx={{ border: "1px solid black", borderLeft: 0, borderRight: 0 }}
            >
              {/* Left column (Supplier info) */}
              <Grid item xs={6} sx={{ borderRight: "1px solid black" }}>
                <Box sx={{ p: 1 }}>
                  <Typography fontWeight="bold" fontSize="12px">
                    Supplier Details:
                  </Typography>
                  <Typography fontWeight="bold" fontSize="12px">
                    {poData.poDetails.supplier.name}
                  </Typography>
                  {poData.poDetails.supplier.address
                    .split("\n")
                    .map((line, i) => (
                      <Typography key={i} fontSize="11px">
                        {line}
                      </Typography>
                    ))}
                  <Typography fontSize="11px">
                    Kind Attention: {poData.poDetails.supplier.contact_person}
                    {poData.poDetails.supplier.contact &&
                      ` (${poData.poDetails.supplier.contact})`}
                  </Typography>
                  <Typography fontSize="11px">
                    Email: {poData.poDetails.supplier.email}
                  </Typography>
                  <Typography fontSize="11px">
                    GST: {poData.poDetails.supplier.gstin}
                  </Typography>
                  <Typography fontSize="11px">
                    PAN No: {poData.poDetails.supplier.pan}
                  </Typography>
                  <Typography fontSize="11px">
                    State: {poData.poDetails.supplier.state}
                  </Typography>
                  <Typography fontSize="11px">
                    State Code: {poData.poDetails.supplier.stateCode}
                  </Typography>
                </Box>

                {/* Billing Address */}
                <Box sx={{ p: 1, borderTop: "1px solid black" }}>
                  <Typography fontWeight="bold" fontSize="12px">
                    Billing Address:
                  </Typography>
                  <Typography fontWeight="bold" fontSize="12px">
                    {poData.poDetails.invoiceTo.name}
                  </Typography>
                  {poData.poDetails.invoiceTo.address
                    .split("\n")
                    .map((line, i) => (
                      <Typography key={i} fontSize="11px">
                        {line}
                      </Typography>
                    ))}
                  <Typography fontSize="11px">GST: 24AABCC1410E1ZL</Typography>
                  <Typography fontSize="11px">PAN No: AABCC1410E</Typography>
                  <Typography fontSize="11px">
                    State: Gujarat. State Code: 24
                  </Typography>
                </Box>
              </Grid>

              {/* Right column (PO details) */}
              <Grid item xs={6}>
                <TableContainer
                  sx={{ "& table": { borderCollapse: "collapse" } }}
                >
                  <Table size="small" padding="none">
                    <TableBody>
                      {[
                        ["CIMCON PO Number", poData.poDetails.poNumber],
                        ["PO Date", formattedPoDate],
                        ["PO Version", "01"],
                        [
                          "Quote Ref. Number",
                          poData.poDetails.quoteRefNumber || "By email. Dt.-",
                        ],
                        ["Project Code", poData.poDetails.projectCode],
                        [
                          "Freight & Insurance",
                          poData.poDetails.freightAndInsurance,
                        ],
                        ["Payment Terms", poData.poDetails.terms.payment],
                        ["Guarantee/Warranty", poData.poDetails.terms.warranty],
                        ["TPI Inspection", poData.poDetails.tpiInspection],
                        ["Installation", poData.poDetails.installation],
                        ["Commissioning", poData.poDetails.commissioning],
                        ["Delivery Schedule", poData.deliverySchedule],
                        [
                          "Vendor Code",
                          poData.poDetails.supplier.vendorCode || "--",
                        ],
                      ].map(([label, value], idx) => (
                        <TableRow key={idx}>
                          <TableCell
                            sx={{
                              border: "1px solid black",
                              borderLeft: 0,
                              fontWeight: "bold",
                              fontSize: "11px",
                              p: 0.5,
                              width: "35%",
                            }}
                          >
                            {label}
                          </TableCell>
                          <TableCell
                            sx={{
                              border: "1px solid black",
                              borderRight: 0,
                              fontSize: "11px",
                              p: 0.5,
                            }}
                          >
                            {value}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Delivery Address */}
                <Box sx={{ p: 1, borderTop: "1px solid black" }}>
                  <Typography fontWeight="bold" fontSize="12px">
                    Delivery Address:
                  </Typography>
                  {poData.deliveryAddress.split(",").map((part, i) => (
                    <Typography key={i} fontSize="11px">
                      {part.trim()}
                    </Typography>
                  ))}
                </Box>
              </Grid>
            </Grid>

            {/* Items Table */}
            <TableContainer
              sx={{
                border: "1px solid black",
                borderLeft: 0,
                borderRight: 0,
                "& table": { borderCollapse: "collapse" },
              }}
            >
              <Table size="small" padding="none">
                <TableHead>
                  <TableRow sx={{ bgcolor: "#f5f5f5" }}>
                    <TableCell
                      align="center"
                      sx={{
                        border: "1px solid black",
                        fontWeight: "bold",
                        fontSize: "11px",
                        p: 0.5,
                        width: "5%",
                      }}
                    >
                      S/N
                    </TableCell>
                    <TableCell
                      sx={{
                        border: "1px solid black",
                        fontWeight: "bold",
                        fontSize: "11px",
                        p: 0.5,
                        width: "15%",
                      }}
                    >
                      CIMCON P/N
                    </TableCell>
                    <TableCell
                      sx={{
                        border: "1px solid black",
                        fontWeight: "bold",
                        fontSize: "11px",
                        p: 0.5,
                        width: "25%",
                      }}
                    >
                      Description
                    </TableCell>
                    <TableCell
                      sx={{
                        border: "1px solid black",
                        fontWeight: "bold",
                        fontSize: "11px",
                        p: 0.5,
                        width: "10%",
                      }}
                    >
                      HSN/SAC
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{
                        border: "1px solid black",
                        fontWeight: "bold",
                        fontSize: "11px",
                        p: 0.5,
                        width: "8%",
                      }}
                    >
                      Qty.
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        border: "1px solid black",
                        fontWeight: "bold",
                        fontSize: "11px",
                        p: 0.5,
                        width: "10%",
                      }}
                    >
                      Unit Rate
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        border: "1px solid black",
                        fontWeight: "bold",
                        fontSize: "11px",
                        p: 0.5,
                        width: "10%",
                      }}
                    >
                      Taxable Value
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        border: "1px solid black",
                        fontWeight: "bold",
                        fontSize: "11px",
                        p: 0.5,
                        width: "7%",
                      }}
                    >
                      GST
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        border: "1px solid black",
                        fontWeight: "bold",
                        fontSize: "11px",
                        p: 0.5,
                        width: "10%",
                      }}
                    >
                      Total Amount
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {poData.items.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell
                        align="center"
                        sx={{
                          border: "1px solid black",
                          fontSize: "11px",
                          p: 0.5,
                        }}
                      >
                        {item.srNo}
                      </TableCell>
                      <TableCell
                        sx={{
                          border: "1px solid black",
                          fontSize: "11px",
                          p: 0.5,
                        }}
                      >
                        {item.cpn}
                      </TableCell>
                      <TableCell
                        sx={{
                          border: "1px solid black",
                          fontSize: "11px",
                          p: 0.5,
                        }}
                      >
                        {item.description}
                      </TableCell>
                      <TableCell
                        sx={{
                          border: "1px solid black",
                          fontSize: "11px",
                          p: 0.5,
                        }}
                      >
                        {item.hsnSac}
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{
                          border: "1px solid black",
                          fontSize: "11px",
                          p: 0.5,
                        }}
                      >
                        {item.quantity} {item.uom}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          border: "1px solid black",
                          fontSize: "11px",
                          p: 0.5,
                        }}
                      >
                        {poData.currency.symbol} {item.unitRate.toFixed(2)}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          border: "1px solid black",
                          fontSize: "11px",
                          p: 0.5,
                        }}
                      >
                        {poData.currency.symbol} {item.taxableValue.toFixed(2)}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          border: "1px solid black",
                          fontSize: "11px",
                          p: 0.5,
                        }}
                      >
                        {poData.currency.symbol} {item.gst.toFixed(2)}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          border: "1px solid black",
                          fontSize: "11px",
                          p: 0.5,
                        }}
                      >
                        {poData.currency.symbol} {item.totalAmount.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow sx={{ bgcolor: "#f9f9f9" }}>
                    <TableCell
                      colSpan={4}
                      align="right"
                      sx={{
                        border: "1px solid black",
                        fontWeight: "bold",
                        fontSize: "11px",
                        p: 0.5,
                      }}
                    >
                      Total ({poData.currency.code})
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{
                        border: "1px solid black",
                        fontWeight: "bold",
                        fontSize: "11px",
                        p: 0.5,
                      }}
                    >
                      {poData.totals.quantity} {poData.items[0]?.uom || "Nos"}
                    </TableCell>
                    <TableCell sx={{ border: "1px solid black", p: 0.5 }} />
                    <TableCell
                      align="right"
                      sx={{
                        border: "1px solid black",
                        fontWeight: "bold",
                        fontSize: "11px",
                        p: 0.5,
                      }}
                    >
                      {poData.currency.symbol}{" "}
                      {poData.totals.taxableValue.toFixed(2)}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        border: "1px solid black",
                        fontWeight: "bold",
                        fontSize: "11px",
                        p: 0.5,
                      }}
                    >
                      {poData.currency.symbol} {poData.totals.gst.toFixed(2)}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        border: "1px solid black",
                        fontWeight: "bold",
                        fontSize: "11px",
                        p: 0.5,
                      }}
                    >
                      {poData.currency.symbol}{" "}
                      {poData.totals.totalAmount.toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>

            {/* Additional rows for total */}
            <TableContainer
              sx={{
                border: "1px solid black",
                borderLeft: 0,
                borderRight: 0,
                borderTop: 0,
                "& table": { borderCollapse: "collapse" },
              }}
            >
              <Table size="small" padding="none">
                <TableBody>
                  <TableRow>
                    <TableCell
                      sx={{
                        border: "1px solid black",
                        fontSize: "11px",
                        p: 0.5,
                        width: "15%",
                      }}
                    >
                      Taxable Value
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        border: "1px solid black",
                        fontSize: "11px",
                        p: 0.5,
                      }}
                    >
                      {poData.currency.symbol}{" "}
                      {poData.totals.taxableValue.toFixed(2)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell
                      sx={{
                        border: "1px solid black",
                        fontSize: "11px",
                        p: 0.5,
                      }}
                    >
                      GST
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        border: "1px solid black",
                        fontSize: "11px",
                        p: 0.5,
                      }}
                    >
                      {poData.currency.symbol} {poData.totals.gst.toFixed(2)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell
                      sx={{
                        border: "1px solid black",
                        fontSize: "11px",
                        p: 0.5,
                      }}
                    >
                      Round Off
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        border: "1px solid black",
                        fontSize: "11px",
                        p: 0.5,
                      }}
                    >
                      {poData.currency.symbol} {poData.totals.roundOff || 0}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell
                      sx={{
                        border: "1px solid black",
                        fontWeight: "bold",
                        fontSize: "11px",
                        p: 0.5,
                      }}
                    >
                      Total
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        border: "1px solid black",
                        fontWeight: "bold",
                        fontSize: "11px",
                        p: 0.5,
                      }}
                    >
                      {poData.currency.symbol}{" "}
                      {poData.totals.totalAmount.toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>

            {/* Total in words */}
            <TableContainer
              sx={{
                border: "1px solid black",
                borderLeft: 0,
                borderRight: 0,
                borderTop: 0,
                "& table": { borderCollapse: "collapse" },
              }}
            >
              <Table size="small" padding="none">
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ fontSize: "11px", p: 0.8 }}>
                      Total Value (In words):{" "}
                      <strong>{poData.totalInWords}</strong>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>

            {/* Footer */}
            <Box
              sx={{
                mt: "auto",
                display: "flex",
                borderLeft: 0,
                borderRight: 0,
                borderBottom: 0,
              }}
            >
              <img
                src="/footer.png"
                alt="CIMCON Software (India) Pvt. Ltd."
                width="100%"
              />
            </Box>
          </Box>
        </Paper>

        {/* Clear page break */}
        <div className="page-break"></div>

        {/* Second page - Terms & Conditions */}
        <Paper
          className="print-container second-page"
          elevation={0}
          sx={{
            width: "210mm",
            minHeight: "297mm",
            margin: "20px auto",
            padding: 0,
            border: "1px solid black",
            fontFamily: "Arial, sans-serif",
            pageBreakBefore: "always",
            position: "relative",
          }}
        >
          {/* Header for second page */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              p: 1,
              borderBottom: "1px solid black",
            }}
          >
            <img
              src="/header.png"
              alt="CIMCON Software (India) Pvt. Ltd."
              style={{ width: "100%" }}
            />
          </Box>

          <Box sx={{ p: 2 }}>
            <Typography
              variant="h6"
              gutterBottom
              fontWeight="bold"
              align="center"
            >
              Commercial Terms & Conditions
            </Typography>

            {/* Editable T&C content */}
            <Box
              contentEditable={true}
              suppressContentEditableWarning={true}
              dangerouslySetInnerHTML={{ __html: tcContent }}
              onInput={handleTcChange}
              className="tc-section"
              sx={{
                width: "100%",
                fontSize: "11px",
                padding: 2,
                border: "1px solid #ddd",
                borderRadius: 1,
                marginTop: 1,
                background: "#fafafa",
                cursor: "text",
                "&:focus": {
                  outline: "2px solid #1976d2",
                  background: "#fff",
                },
                "& ol": { marginLeft: 2 },
                "& li": { marginBottom: "8px" },
              }}
            />
          </Box>

          {/* Footer for second page */}
          <Box
            sx={{
              mt: 4,
              display: "flex",
              borderLeft: 0,
              borderRight: 0,
              borderBottom: 0,
            }}
          >
            <img
              src="/footer.png"
              alt="CIMCON Software (India) Pvt. Ltd."
              width="100%"
            />
          </Box>
        </Paper>
      </Box>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mt: 1 }}
        className="no-print"
      >
        Note: Click on the terms and conditions section above to edit. Your
        changes will be saved for printing.
      </Typography>
    </div>
  );
};

export default POPreviewPrint;
