import { Injectable, Logger } from '@nestjs/common';
import { sheets_v4 } from 'googleapis/build/src/apis/sheets/v4';
import { drive_v3 } from 'googleapis/build/src/apis/drive/v3';
import axios from 'axios';
import { OAuth2Client } from 'google-auth-library';
// import { RefreshTokenService } from 'src/refresh-token/refresh-token.service';
import { config } from 'dotenv';

config(); // Load .env variables

@Injectable()
export class GoogleSheetService {
  //   private readonly logger = new Logger(AuthService.name);

  private readonly oauth2Client: OAuth2Client;

  constructor() { // private readonly refreshTokenService: RefreshTokenService, // Injecting the RefreshTokenService
    this.oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      process.env.GOOGLE_REDIRECT_URI!,
    );

    this.oauth2Client.setCredentials({
      refresh_token:
        '1//06OvfGZcbxn8wCgYIARAAGAYSNwF-L9IrVwIXKtp8fjdfHhNDsb3THCwh6JLINKlDBfiYXWPVkGMZ0JT6SoGcnAZfDac8Cen_LGk', // To be taken from DynamoDb
    });
  }

  async createAndPopulateGoogleSheet(email: string, data): Promise<string> {
    const sheetsApi = new sheets_v4.Sheets({ auth: this.oauth2Client });
    const driveApi = new drive_v3.Drive({ auth: this.oauth2Client });

    // Step 1: Create a new Google Sheet
    const request = {
      properties: {
        title: `${email} Supplier Search`,
      },
    };

    const response = await sheetsApi.spreadsheets.create({
      requestBody: request,
    });
    const spreadsheetId = response.data.spreadsheetId;
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
    console.log(`Spreadsheet created with ID: ${spreadsheetId}`);

    // Step 2: Share the sheet with the user
    await driveApi.permissions.create({
      fileId: spreadsheetId,
      requestBody: {
        role: 'writer', // 'writer' gives edit access
        type: 'user',
        emailAddress: email,
      },
    });

    console.log(`Sheet shared with ${email}.`);

    // Step 3: Populate the Google Sheet with the data
    const supplierData = data.Summary.suppliers;

    // Set up headers
    const headers = [
      [
        'Supplier Name',
        'Revenue',
        'Certifications',
        'Contact Details',
        'Capabilities',
        'Export Countries',
      ],
    ];

    // Format supplier data for each column in the sheet
    const sheetData = supplierData.map((supplier) => [
      supplier.label || '',
      supplier.revenue || '', // Joining revenue data as a comma-separated string
      formatCertifications(supplier.certifications) || '',
      formatContactDetails(supplier.contact) || '', // Handle contactDetails, check if it's an object
      formatCapabilities(supplier.capabilities) || '',
      supplier.export_countries ? supplier.export_countries.join(', ') : '', // Handle null/undefined values for exports
    ]);

    const rows = headers.concat(sheetData).map((row) => ({
      values: row.map((cell) => ({ userEnteredValue: { stringValue: cell } })),
    }));

    // Requests array with new formatting requests
    const requests = [
      // Set headers in the first row
      {
        updateCells: {
          rows: headers.map((values) => ({
            values: values.map((value) => ({
              userEnteredValue: { stringValue: value },
              userEnteredFormat: {
                textFormat: { bold: true },
                backgroundColor: { red: 0.4, green: 0.6, blue: 0.9 },
              },
            })),
          })),
          start: { sheetId: 0, rowIndex: 0, columnIndex: 0 },
          fields:
            'userEnteredValue,userEnteredFormat(textFormat,backgroundColor)',
        },
      },
      // Populate data starting from the second row
      {
        updateCells: {
          rows: sheetData.map((values) => ({
            values: values.map((value) => ({
              userEnteredValue: { stringValue: value },
            })),
          })),
          start: { sheetId: 0, rowIndex: 1, columnIndex: 0 },
          fields: 'userEnteredValue',
        },
      },
      // Set borders for all filled cells
      {
        updateBorders: {
          range: {
            sheetId: 0,
            startRowIndex: 0,
            endRowIndex: rows.length,
            startColumnIndex: 0,
            endColumnIndex: 6,
          },
          top: { style: 'SOLID' },
          bottom: { style: 'SOLID' },
          left: { style: 'SOLID' },
          right: { style: 'SOLID' },
          innerHorizontal: { style: 'SOLID' },
          innerVertical: { style: 'SOLID' },
        },
      },
      // Set max width for columns, apply wrapping, and fit to max width of 275 pixels
      ...headers[0].map((_, colIndex) => ({
        updateDimensionProperties: {
          range: {
            sheetId: 0,
            dimension: 'COLUMNS',
            startIndex: colIndex,
            endIndex: colIndex + 1,
          },
          properties: {
            pixelSize: Math.min(calculateColumnWidth(colIndex), 275),
          },
          fields: 'pixelSize',
        },
      })),
      // Enable text wrap for all cells
      {
        repeatCell: {
          range: { sheetId: 0 },
          cell: { userEnteredFormat: { wrapStrategy: 'WRAP' } },
          fields: 'userEnteredFormat.wrapStrategy',
        },
      },
      // Conditional formatting requests
      // Assuming similar conditions to addNewTabAndPopulateData
      // Add conditional formatting rules as needed...
    ];

    // const requests = [
    //   // Set headers in the first row
    //   {
    //     updateCells: {
    //       rows: headers.map(values => ({
    //         values: values.map(value => ({ userEnteredValue: { stringValue: value } }))
    //       })),
    //       start: { sheetId: 0, rowIndex: 0, columnIndex: 0 },
    //       fields: 'userEnteredValue'
    //     }
    //   },
    //   // Populate data starting from the second row
    //   {
    //     updateCells: {
    //       rows: sheetData.map(values => ({
    //         values: values.map(value => ({ userEnteredValue: { stringValue: value } }))
    //       })),
    //       start: { sheetId: 0, rowIndex: 1, columnIndex: 0 },
    //       fields: 'userEnteredValue'
    //     }
    //   },
    //   {
    //     autoResizeDimensions: {
    //     dimensions: { sheetId: 0, dimension: 'COLUMNS', startIndex: 0, endIndex: 6 }
    //     }
    //   }

    // ];

    // Execute batchUpdate request to populate the sheet and auto adjust widths
    await sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });

    // Helper functions for formatting
    function calculateColumnWidth(colIndex: number): number {
      const longestCell = rows.reduce((maxWidth, row) => {
        const cell = row.values[colIndex]?.userEnteredValue?.stringValue || '';
        return Math.max(maxWidth, cell.length * 8); // Approximate 7 pixels per character
      }, 50); // Set a minimum width of 50
      return longestCell;
    }

    function formatContactDetails(contact: any): string {
      if (typeof contact === 'string') {
        return contact; // If it's a string, return as is
      }

      if (contact && typeof contact === 'object') {
        const { phone, address, email } = contact;
        // Concatenate phone, address, and email into a single string
        return [
          phone ? `phone - ${phone}` : '',
          address ? `address - ${address}` : '',
          email ? `email - ${email}` : '',
        ]
          .filter(Boolean)
          .join('\n'); // Filter out any empty fields
      }

      return ''; // Return an empty string if no contactDetails
    }

    // Helper function to format certifications with newlines
    function formatCertifications(certifications: any[]): string {
      if (Array.isArray(certifications)) {
        // Join certifications with newline characters
        return certifications.join('\n');
      }
      return ''; // Return an empty string if no certifications
    }

    function formatCapabilities(capabilities: any[]): string {
      if (Array.isArray(capabilities)) {
        // Join certifications with newline characters
        return capabilities.join('\n');
      }
      return ''; // Return an empty string if no certifications
    }

    console.log('Sheet populated successfully!', spreadsheetUrl);
    return spreadsheetUrl;
  }

  async addNewTabAndPopulateData(spreadsheetId: string, sheetName: string, data: any): Promise<string> {
    const sheetsApi = new sheets_v4.Sheets({ auth: this.oauth2Client });
  
    // Add a new sheet
    const addSheetRequest = {
      addSheet: {
        properties: {
            title: sheetName,
            gridProperties: {
                frozenRowCount: 1, // Freeze the first row
                frozenColumnCount: 1 // Freeze the first column
            },
        // properties: { title: sheetName }
       }
    }
    };
  
    const supplierData = data.Summary.suppliers;

    const formattedData = supplierData.map(supplier => [
        supplier.name || "",
        supplier.revenue || "",  // Joining revenue data as a comma-separated string
        formatCertifications(supplier.certifications) || "",
        formatContactDetails(supplier.contactDetails) || "",  // Handle contactDetails, check if it's an object
        formatCapabilities(supplier.capabilities) || "",
        supplier.exports ? supplier.exports.join(", ") : ""  // Handle null/undefined values for exports
        ]);

    const headers = [
           ["Supplier Name", "Revenue", "Certifications", "Contact Details", "Capabilities", "Export Countries"]
        ];

    const rows = headers.concat(formattedData).map(row => ({
          values: row.map(cell => ({ userEnteredValue: { stringValue: cell } }))
        }));

    // Populate the new tab
    const populateDataRequest = {
        updateCells: {
        rows,
        start: { sheetId: null /* This will be set dynamically */, rowIndex: 0, columnIndex: 0 },
        fields: 'userEnteredValue'
        }
    };
        
    // Send batch update request
    const { data: batchResponse } = await sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [addSheetRequest] }
    });
  
    const newSheetId = batchResponse.replies[0].addSheet.properties.sheetId;
    populateDataRequest.updateCells.start.sheetId = newSheetId;
  
    // Populate data in the new tab
    await sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [populateDataRequest] }
    });

    // Define a maximum width limit (in pixels)
    const maxWidth = 275;

    // Set column widths with a maximum limit and enable text wrapping
    const dimensionRequests = headers[0].map((_, colIndex) => ({
        updateDimensionProperties: {
            range: {
                sheetId: newSheetId,
                dimension: "COLUMNS",
                startIndex: colIndex,
                endIndex: colIndex + 1
            },
            properties: {
                pixelSize: Math.min(calculateColumnWidth(colIndex), maxWidth)
            },
            fields: "pixelSize"
        }
    }));

    // Enable text wrap for all cells in the new tab
    const wrapTextRequest = {
        repeatCell: {
            range: {
                sheetId: newSheetId
            },
            cell: {
                userEnteredFormat: {
                    wrapStrategy: "WRAP"
                }
            },
            fields: "userEnteredFormat.wrapStrategy"
        }
    };

    const revenueValues = rows.slice(1).map(row => {
        const revenue = parseFloat(row.values[1]?.userEnteredValue?.stringValue || "NaN");
        return isNaN(revenue) ? 0 : revenue;  // Fallback to 0 if not a valid number
    });
    const minRevenue = Math.min(...revenueValues);
    const maxRevenue = Math.max(...revenueValues);
    const midpointRevenue = (minRevenue + maxRevenue) / 2;

    console.log('Min Revenue:', minRevenue);
    console.log('Max Revenue:', maxRevenue);

    // Conditional Formatting Requests
    const conditionalFormattingRequests = [
    // Revenue column (B): apply green for highest, yellow for lowest, and gradient for in-between
        {
            addConditionalFormatRule: {
                rule: {
                    ranges: [
                    {
                        sheetId: newSheetId,
                        startRowIndex: 1, // Start from the second row (after the header)
                        endRowIndex: rows.length,
                        startColumnIndex: 1, // Revenue column index (B)
                        endColumnIndex: 2
                    },
                   ],
                    gradientRule: {
                        minpoint: {
                            color: { red: 1, green: 1, blue: 0 }, // Yellow for the lowest
                            type: "MIN",
                        },
                        maxpoint: {
                            color: { red: 0, green: 1, blue: 0 }, // Green for the highest
                            type: "MAX",
                        },
                        // midpoint: {
                        //     color: { red: 0, green: 0, blue: 1 }, // Blue for in-between values
                        //     type: "NUMBER",
                        //     value: midpointRevenue.toString()
                        // }
                    }
                },
                index: 0
            },
        },
        // Certifications column (C): apply green for ISO 9001
        {
            addConditionalFormatRule: {
                rule: {
                    ranges: [
                    {
                        sheetId: newSheetId,
                        startRowIndex: 1,
                        endRowIndex: rows.length,
                        startColumnIndex: 2, // Certifications column index (C)
                        endColumnIndex: 3
                    },
                ],
                    booleanRule: {
                        condition: {
                            type: "TEXT_CONTAINS",
                            values: [
                                { userEnteredValue: "ISO 9001" } // Green if contains ISO 9001
                            ]
                        },
                        format: {
                            backgroundColor: { red: 0.7, green: 1, blue: 0.7 } // Green color
                        }
                    }
                },
                index: 1
            }
        }
    ];


    await sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
            requests: [
                ...dimensionRequests,
                wrapTextRequest,
                ...conditionalFormattingRequests,
                {
                    // Bold headers
                    updateCells: {
                        rows: [
                            {
                                values: headers[0].map(cell => ({
                                    userEnteredFormat: {
                                        textFormat: { bold: true },
                                        backgroundColor: { red: 0.4, green: 0.7, blue: 1 } // Light blue color
                                    },
                                    userEnteredValue: { stringValue: cell }
                                }))
                            }
                        ],
                        start: { sheetId: newSheetId, rowIndex: 0, columnIndex: 0 },
                        fields: "userEnteredFormat.textFormat, userEnteredFormat.backgroundColor"
                    }
                },
                // Add borders to all filled cells
                {
                    updateBorders: {
                        range: {
                            sheetId: newSheetId,
                            startRowIndex: 0, // Start from row 0 for headers
                            endRowIndex: rows.length, // End at the last row
                            startColumnIndex: 0, // Start at the first column
                            endColumnIndex: 6 // End at the 6th column (since there are 6 columns)
                        },
                        top: { style: "SOLID", width: 1, color: { red: 0, green: 0, blue: 0 } }, // Black border for top
                        bottom: { style: "SOLID", width: 1, color: { red: 0, green: 0, blue: 0 } }, // Black border for bottom
                        left: { style: "SOLID", width: 1, color: { red: 0, green: 0, blue: 0 } }, // Black border for left
                        right: { style: "SOLID", width: 1, color: { red: 0, green: 0, blue: 0 } }, // Black border for right
                        innerHorizontal: { style: "SOLID", width: 1 },
                        innerVertical: { style: "SOLID", width: 1 }
                    }
                }
            ]
        }
        // requestBody: { requests: [...dimensionRequests, wrapTextRequest] }
    });

    // Helper to calculate width based on the longest cell in the column
    function calculateColumnWidth(colIndex: number): number {
        const longestCell = rows.reduce((maxWidth, row) => {
            const cell = row.values[colIndex]?.userEnteredValue?.stringValue || '';
            const width = cell.length * 7; // Estimate: 7 pixels per character
            return Math.max(maxWidth, width);
        }, 50); // Set a minimum width of 50
        return longestCell;
    }

    function formatContactDetails(contactDetails: any): string {
        if (typeof contactDetails === 'string') {
          return contactDetails;  // If it's a string, return as is
        }
      
        if (contactDetails && typeof contactDetails === 'object') {
          const { phone, address, email } = contactDetails;
          // Concatenate phone, address, and email into a single string
          return [
            phone ? `Phone - ${phone}` : "",
            address ? `Address - ${address}` : "",
            email ? `Email - ${email}` : ""
          ].filter(Boolean).join("\n");  // Filter out any empty fields
        }
      
        return "";  // Return an empty string if no contactDetails
    }

    // Helper function to format certifications with newlines
    function formatCertifications(certifications: any[]): string {
        if (Array.isArray(certifications)) {
        // Join certifications with newline characters
        return certifications.join("\n");
        }
        return "";  // Return an empty string if no certifications
    }

    function formatCapabilities(capabilities: any[]): string {
        if (Array.isArray(capabilities)) {
        // Join certifications with newline characters
        return capabilities.join("\n");
        }
        return "";  // Return an empty string if no certifications
    }
  
    console.log(`New tab '${sheetName}' created, populated and column widths set with wrap formatting.`);

    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${newSheetId}`;
    console.log(`Spreadsheet URL with direct access to new tab: ${spreadsheetUrl}`);

    return spreadsheetUrl;
  }

}
