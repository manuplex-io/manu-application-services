import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { KafkaContext } from '@nestjs/microservices';
import { KafkaOb1Service } from 'src/kafka-ob1/kafka-ob1.service';
import { TavilySearchService } from './tavily-search.service';
// import { GoogleSheetService } from './google-sheet.service';
import { schemas } from './prompts';
import axios from 'axios';

import {
  OB1MessageHeader,
  OB1MessageValue,
  CURRENT_SCHEMA_VERSION,
} from 'src/interfaces/ob1-message.interfaces';

@Injectable()
export class SlackEventHandlingService implements OnModuleInit {
    private readonly slackBotToken = process.env.slack_token //PlexTestOrg1
  constructor(
    private readonly kafkaService: KafkaOb1Service,
    // private readonly tavilySearchService: TavilySearchService,
    // private readonly googleSheetService: GoogleSheetService,
  ) {}

  async onModuleInit() {}

  async slackreply(functionInput: any, context: KafkaContext) {
    // const headers: OB1MessageHeader = context.getMessage()
    //   .headers as unknown as OB1MessageHeader;
    const messageKey = context.getMessage().key.toString();
    // const instanceName = context.getMessage().headers.instanceName.toString();
    // const supplierRawData = await this.getSupplierInfo(functionInput, context);
    // const supplierList = JSON.stringify(supplierRawData.results);
    const destinationService = 'database-service';
    const sourceFunction = 'handleSlackEvents';
    const sourceType = 'service';
    const userRole = 'consultant'
    const userEmail = 'aadisharma8441@gmail.com'
    // const projectName = functionInput.projectName;
    const userInput = functionInput.userInput;
    const instanceName = 'Dummy Instance Name' // Needs to be changed
    const channel = functionInput.fromChannel;
    const user = functionInput.fromUSer;


    const userPrompt = `Your name is Plex. You are a helpful assistant. Respond to user's question smartly. Here is user's question:${userInput}`;
    const responseFormat = ''; // Need to change
    const response = await this.callLLM(
      userPrompt,
      responseFormat,
    //   headers.userRole.toString(),
      userRole,
    //   headers.userEmail.toString(),
      userEmail,
      messageKey,
      instanceName,
      'gpt-4o-mini',
    );

    const plexReply = response.messageContent.content;
    console.log('Response from Plex', plexReply);

    await this.sendMessage(channel, plexReply);

    // const messageInput = {
    //   messageContent: {
    //     functionName: 'CRUDUserfunction',
    //     functionInput: {
    //       CRUDName: 'POST',
    //       CRUDInput: {
    //         tableEntity: 'OB1-assets',
    //         assetName: 'SupplierListv1',
    //         projectName: projectName,
    //         assetData: supplierListV1,
    //         assetType: 'SupplierList',
    //       },
    //     },
    //   },
    // };
    // const messageInputAdd = {
    //   messageType: 'REQUEST',
    //   ...messageInput,
    // };

    // const response1 = this.kafkaService.sendRequestSystem(
    //   messageKey,
    //   instanceName,
    //   destinationService,
    //   sourceFunction,
    //   sourceType,
    //   messageInputAdd,
    //   headers.userRole.toString(),
    //   headers.userEmail.toString(),
    // );

    // const messageInput1 = {
    //   messageContent: {
    //     functionName: 'CRUDUserfunction',
    //     functionInput: {
    //       CRUDName: 'POST',
    //       CRUDInput: {
    //         tableEntity: 'OB1-assets',
    //         assetName: 'supplierGoogleSheet',
    //         projectName: projectName,
    //         assetExternalUrl: googleSheetURL,
    //         assetType: 'googleSheet',
    //       },
    //     },
    //   },
    // };
    // const messageInputAdd1 = {
    //   messageType: 'REQUEST',
    //   ...messageInput1,
    // };

    // const response2 = this.kafkaService.sendRequestSystem(
    //   messageKey,
    //   instanceName,
    //   destinationService,
    //   sourceFunction,
    //   sourceType,
    //   messageInputAdd1,
    //   headers.userRole.toString(),
    //   headers.userEmail.toString(),
    // );

    // return {
    //   messageContent: {
    //     content: responseWithExportCountries,
    //     url: googleSheetURL,
    //   },
    // };
  }

  async callLLM(
    userPrompt,
    responseFormat,
    userRole,
    userEmail,
    messageKey,
    instanceName,
    model,
  ) {
    const destinationService = 'agent-services';
    const sourceFunction = 'findSupplier';
    const sourceType = 'service';
    const messageInput = {
      messageContent: {
        functionName: 'LLMgenerateResponse',
        functionInput: {
          userPrompt: userPrompt,
          responseFormat: responseFormat,
          config: {
            provider: 'openai',
            model: model,
            temperature: 0.7,
            maxTokens: 4096,
            topP: 1,
            frequencyPenalty: 0,
            presencePenalty: 0,
          },
        },
      },
    };

    const messageInputAdd = {
      messageType: 'REQUEST',
      ...messageInput,
    };

    const response = await this.kafkaService.sendRequest(
      messageKey,
      instanceName,
      destinationService,
      sourceFunction,
      sourceType,
      messageInputAdd,
      userRole,
      userEmail,
    );
    return response;
  }

  private async sendMessage(channel: string, text: string) {
    try {
      await axios.post(
        'https://slack.com/api/chat.postMessage',
        { channel, text },
        {
          headers: {
            Authorization: `Bearer ${this.slackBotToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
      console.log('Reply sent', text)
    } catch (error) {
      console.error('Error sending message:', error.response?.data || error.message);
    }
  }
}
