import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { KafkaContext } from '@nestjs/microservices';
import { KafkaOb1Service } from 'src/kafka-ob1/kafka-ob1.service';
import { TavilySearchService } from './tavily-search.service';
// import { GoogleSheetService } from './google-sheet.service';
import { schemas } from './prompts';
import axios from 'axios';
import { IncomingWebhook } from '@slack/webhook';

import {
  OB1MessageHeader,
  OB1MessageValue,
  CURRENT_SCHEMA_VERSION,
} from 'src/interfaces/ob1-message.interfaces';
import { SlackChannelService } from './slack-channel-service';

@Injectable()
export class SlackEventHandlingService implements OnModuleInit {
    private readonly slackBotToken = process.env.slack_token //PlexTestOrg1
    private readonly webhookURL = process.env.webhookURL //webhook URL
    private readonly webhook : IncomingWebhook//webhook URL

  constructor(
    private readonly kafkaService: KafkaOb1Service,
    private readonly slackService: SlackChannelService,
    // private readonly tavilySearchService: TavilySearchService,
    // private readonly googleSheetService: GoogleSheetService,
  ) {
    this.webhook = new IncomingWebhook(this.webhookURL);
  }

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
    const user = functionInput.fromUser;


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

  async slackNotification(functionInput: any, context: KafkaContext) {
    const userId = functionInput.fromUser;
    const userObject = await this.slackService.findUser(userId,this.slackBotToken)
    const userName = userObject.user.name
    const text = functionInput.userInput;
    const channelId = functionInput.fromChannel;
    const channelobject = await this.slackService.findChannel(channelId,this.slackBotToken)
    const channelName = channelobject.channel.name
    const timestamp = new Date(Number(functionInput.timestamp) * 1000).toLocaleString(); // Convert Slack timestamp
    const notificationMessage = `User @${userName} has sent a message to channel '${channelName}':\n> '${text}'\nAt: ${timestamp}`;
    console.log('Receieved message from user object', userObject)
    console.log('Received message in channel object', channelobject)

    try {
        await this.webhook.send({
          text: notificationMessage,
        });
      } catch (error) {
        console.error('Error sending message to Slack:', error);
        throw new Error('Failed to send message to Slack');
      }
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

//   async slackNotification(functionInput: any, context: KafkaContext) {
//     try {
//         await this.webhook.send({
//             "channel": "C123ABC456",
//             "text": "New Paid Time Off request from Fred Enriquez",
//             "blocks": [
//               {
//                 "type": "header",
//                 "text": {
//                 "type": "plain_text",
//                   "text": "New request",
//                   "emoji": true
//                 }
//               },
//               {
//                 "type": "section",
//                 "fields": [
//                   {
//                     "type": "mrkdwn",
//                     "text": "*Type:*\nPaid Time Off"
//                   },
//                   {
//                     "type": "mrkdwn",
//                     "text": "*Created by:*\n<example.com|Fred Enriquez>"
//                   }
//                 ]
//               },
//               {
//                 "type": "section",
//                 "fields": [
//                   {
//                     "type": "mrkdwn",
//                     "text": "*When:*\nAug 10 - Aug 13"
//                   }
//                 ]
//               },
//               {
//                 "type": "actions",
//                 "elements": [
//                   {
//                     "type": "button",
//                     "text": {
//                       "type": "plain_text",
//                       "emoji": true,
//                       "text": "Approve"
//                     },
//                     "style": "primary",
//                     "value": "click_me_123"
//                   },
//                   {
//                     "type": "button",
//                     "text": {
//                       "type": "plain_text",
//                       "emoji": true,
//                       "text": "Reject"
//                     },
//                       "style": "danger",
//                       "value": "click_me_123"
//                   }
//                 ]
//               }
//             ]
//           });
//       } catch (error) {
//         console.error('Error sending message to Slack:', error);
//         throw new Error('Failed to send message to Slack');
//       }
//   }
}
