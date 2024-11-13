import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { KafkaContext } from '@nestjs/microservices';
import { KafkaOb1Service } from 'src/kafka-ob1/kafka-ob1.service';
import { schemas } from './prompts';

import {
  OB1MessageHeader,
  OB1MessageValue,
  CURRENT_SCHEMA_VERSION,
} from 'src/interfaces/ob1-message.interfaces';

@Injectable()
export class ShortlistSupplierService implements OnModuleInit {
  constructor(private readonly kafkaService: KafkaOb1Service) {}

  async onModuleInit() {}

  async findAssetByName(data: any, assetName: string) {
    for (const key in data.messageContent) {
      const asset = data.messageContent[key];
      if (asset.assetName === assetName) {
        return { key, asset };
      }
    }
    return null;
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

    const supplierListV1 = this.kafkaService.sendRequestSystem(
      messageKey,
      instanceName,
      destinationService,
      sourceFunction,
      sourceType,
      messageInputAdd,
      userRole,
      userEmail,
    );

    return supplierListV1;
  }
}
