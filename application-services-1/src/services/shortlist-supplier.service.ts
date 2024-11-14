import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { KafkaContext } from '@nestjs/microservices';
import { KafkaOb1Service } from 'src/kafka-ob1/kafka-ob1.service';
import { GoogleSheetService } from 'src/google-sheet/google-sheet.service';
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

  async shortListSupplier(functionInput: any, context: KafkaContext) {
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

    const shortlistedSupplierList = await this.filterByExportCountry(
      supplierListInitial,
      ['USA', 'United States', 'US', 'United States of America'],
    );
    console.log('shortListedSupplierList', shortlistedSupplierList);

    const googleSheetInput = {
      Summary: {
        suppliers: shortlistedSupplierList,
      },
    };

    // const googleSheetURL =
    //   await this.googleSheetService.addNewTabAndPopulateData(
    //     headers.userEmail.toString(),
    //     googleSheetInput,
    //   );

    return assetList;
  }
}
