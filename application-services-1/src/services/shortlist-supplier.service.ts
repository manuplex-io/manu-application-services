import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { KafkaContext } from '@nestjs/microservices';
import { KafkaOb1Service } from 'src/kafka-ob1/kafka-ob1.service';
import { GoogleSheetService } from './google-sheet.service';
import { schemas } from './prompts';

import {
  OB1MessageHeader,
  OB1MessageValue,
  CURRENT_SCHEMA_VERSION,
} from 'src/interfaces/ob1-message.interfaces';

@Injectable()
export class ShortlistSupplierService implements OnModuleInit {
  constructor(
    private readonly kafkaService: KafkaOb1Service,
    private readonly googleSheetService: GoogleSheetService,
  ) {}

  async onModuleInit() {}

  async filterByAssetName(arr: any, assetName: string) {
    return arr.filter((element: any) => element.assetName === assetName);
  }

  async filterByExportCountry(supplierListInitial: any, countries: string[]) {
    const supplierList = supplierListInitial[0].assetData.supplierListV1;
    return supplierList.filter((element: any) =>
      countries.some((country) =>
        element.export_countries.some((exportCountry: any) =>
          exportCountry.includes(country),
        ),
      ),
    );
  }

  async filterByCertification(supplierListInitial: any, orderFormInitial: any) {
    const supplierList = supplierListInitial[0].assetData.supplierListV1;
    const orderForm = orderFormInitial[0].assetData;
    const certificationList = orderForm.certifications;
    const certifications = certificationList.map((item: any) => item.label);
    const filteredSupplierList = supplierList.filter((supplier: any) => {
      // Check if any certification of the supplier matches any label in `certification`
      return supplier.certifications.some((cert: any) =>
        certifications.includes(cert),
      );
    });
    return filteredSupplierList;
  }

  async shortListSupplier(functionInput: any, context: KafkaContext) {
    const headers: OB1MessageHeader = context.getMessage()
      .headers as unknown as OB1MessageHeader;
    const criteria = functionInput.criteria;
    const projectName = functionInput.projectName;
    const messageKey = context.getMessage().key.toString();
    const instanceName = context.getMessage().headers.instanceName.toString();
    const destinationService = 'database-service';
    const sourceFunction = 'shortlistSupplier';
    const sourceType = 'service';
    const userRole = context.getMessage().headers.userRole.toString();
    const userEmail = context.getMessage().headers.userEmail.toString();

    const messageInput = {
      messageContent: {
        functionName: 'CRUDUserfunction',
        functionInput: {
          CRUDName: 'GET',
          CRUDInput: {
            tableEntity: 'OB1-assets',
            projectName: projectName,
          },
        },
      },
    };

    const messageInputAdd = {
      messageType: 'REQUEST',
      ...messageInput,
    };

    const assetList = await this.kafkaService.sendRequestSystem(
      messageKey,
      instanceName,
      destinationService,
      sourceFunction,
      sourceType,
      messageInputAdd,
      userRole,
      userEmail,
    );

    const supplierListInitial = await this.filterByAssetName(
      assetList.messageContent,
      'SupplierListv1',
    );
    console.log('supplierListInitial', supplierListInitial);

    const orderFormInitial = await this.filterByAssetName(
      assetList.messageContent,
      'orderForm',
    );
    console.log('orderFormInitial', orderFormInitial);

    const initialGoogleSheet = await this.filterByAssetName(
      assetList.messageContent,
      'supplierGoogleSheet',
    );
    console.log('initialGoogleSheet', initialGoogleSheet);
    let shortlistedSupplierList = [];

    if (criteria[0] === 'certification') {
      shortlistedSupplierList = await this.filterByCertification(
        supplierListInitial,
        orderFormInitial,
      );
    } else if (criteria[0] === 'export') {
      shortlistedSupplierList = await this.filterByExportCountry(
        supplierListInitial,
        ['USA', 'United States', 'US', 'United States of America'],
      );
    }

    console.log('shortListedSupplierList', shortlistedSupplierList);

    const initialGoogleSheetUrl = initialGoogleSheet[0].assetExternalUrl;
    console.log('initialGoogleSheetUrl', initialGoogleSheetUrl);

    const spreadsheetId = initialGoogleSheetUrl.match(
      /\/d\/([a-zA-Z0-9-_]+)/,
    )[1];

    const googleSheetInput = {
      Summary: {
        suppliers: shortlistedSupplierList,
      },
    };

    const newGoogleSheetUrl =
      await this.googleSheetService.addNewTabAndPopulateData(
        spreadsheetId,
        'shortlistedSuppliers',
        googleSheetInput,
      );

    return {
      messageContent: {
        content: shortlistedSupplierList,
        url: newGoogleSheetUrl,
      },
    };
  }
}
