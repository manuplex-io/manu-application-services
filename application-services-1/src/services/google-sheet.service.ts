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

  constructor(
    // private readonly refreshTokenService: RefreshTokenService, // Injecting the RefreshTokenService
  ) {
    this.oauth2Client = new OAuth2Client(
        process.env.GOOGLE_CLIENT_ID!,
        process.env.GOOGLE_CLIENT_SECRET!,
        process.env.GOOGLE_REDIRECT_URI!
      );

    this.oauth2Client.setCredentials({
        refresh_token: '1//06OvfGZcbxn8wCgYIARAAGAYSNwF-L9IrVwIXKtp8fjdfHhNDsb3THCwh6JLINKlDBfiYXWPVkGMZ0JT6SoGcnAZfDac8Cen_LGk',  // To be taken from DynamoDb
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
    
    const response = await sheetsApi.spreadsheets.create({ requestBody: request });
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
      ["Supplier Name", "Revenue", "Certifications", "Contact Details", "Capabilities", "Export Countries"]
    ];

    // Format supplier data for each column in the sheet
    const sheetData = supplierData.map(supplier => [
    supplier.label || "",
    supplier.revenue || "",  // Joining revenue data as a comma-separated string
    formatCertifications(supplier.certifications) || "",
    formatContactDetails(supplier.contact) || "",  // Handle contactDetails, check if it's an object
    formatCapabilities(supplier.capabilities) || "",
    supplier.export_countries ? supplier.export_countries.join(", ") : ""  // Handle null/undefined values for exports
    ]);

    const rows = headers.concat(sheetData).map(row => ({
        values: row.map(cell => ({ userEnteredValue: { stringValue: cell } }))
      }));
  
    // Requests array with new formatting requests
    const requests = [
        // Set headers in the first row
        {
          updateCells: {
            rows: headers.map(values => ({
              values: values.map(value => ({
                userEnteredValue: { stringValue: value },
                userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.4, green: 0.4, blue: 0.6 } }
              }))
            })),
            start: { sheetId: 0, rowIndex: 0, columnIndex: 0 },
            fields: 'userEnteredValue,userEnteredFormat(textFormat,backgroundColor)'
          }
        },
        // Populate data starting from the second row
        {
          updateCells: {
            rows: sheetData.map(values => ({
              values: values.map(value => ({ userEnteredValue: { stringValue: value } }))
            })),
            start: { sheetId: 0, rowIndex: 1, columnIndex: 0 },
            fields: 'userEnteredValue'
          }
        },
        // Set borders for all filled cells
        {
          updateBorders: {
            range: {
              sheetId: 0,
              startRowIndex: 0,
              endRowIndex: rows.length,
              startColumnIndex: 0,
              endColumnIndex: 6
            },
            top: { style: "SOLID" },
            bottom: { style: "SOLID" },
            left: { style: "SOLID" },
            right: { style: "SOLID" },
            innerHorizontal: { style: "SOLID" },
            innerVertical: { style: "SOLID" }
          }
        },
        // Set max width for columns, apply wrapping, and fit to max width of 275 pixels
        ...headers[0].map((_, colIndex) => ({
          updateDimensionProperties: {
            range: { sheetId: 0, dimension: "COLUMNS", startIndex: colIndex, endIndex: colIndex + 1 },
            properties: { pixelSize: Math.min(calculateColumnWidth(colIndex), 275) },
            fields: "pixelSize"
          }
        })),
        // Enable text wrap for all cells
        {
          repeatCell: {
            range: { sheetId: 0 },
            cell: { userEnteredFormat: { wrapStrategy: "WRAP" } },
            fields: "userEnteredFormat.wrapStrategy"
          }
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
      requestBody: { requests }
    });

    // Helper functions for formatting
    function calculateColumnWidth(colIndex: number): number {
        const longestCell = rows.reduce((maxWidth, row) => {
        const cell = row.values[colIndex]?.userEnteredValue?.stringValue || '';
        return Math.max(maxWidth, cell.length * 7); // Approximate 7 pixels per character
        }, 50); // Set a minimum width of 50
        return longestCell;
    }

    function formatContactDetails(contact: any): string {
        if (typeof contact === 'string') {
          return contact;  // If it's a string, return as is
        }
      
        if (contact && typeof contact === 'object') {
          const { phone, address, email } = contact;
          // Concatenate phone, address, and email into a single string
          return [
            phone ? `phone - ${phone}` : "",
            address ? `address - ${address}` : "",
            email ? `email - ${email}` : ""
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

    console.log("Sheet populated successfully!");
    return spreadsheetUrl;
  }
}
