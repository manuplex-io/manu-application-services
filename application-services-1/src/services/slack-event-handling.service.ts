import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
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
import { extractUserIds, findWorkspace } from './slack-utils';

@Injectable()
export class SlackEventHandlingService implements OnModuleInit {
  // private readonly slackBotToken = process.env.slack_token //PlexTestOrg1
  private readonly webhookURL = process.env.webhookURL; //webhook URL
  private readonly webhook: IncomingWebhook; //webhook URL
  private readonly logger = new Logger(SlackChannelService.name);
  private readonly SLACK_BASE_URL = 'https://slack.com/api';

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
    const userRole = 'consultant';
    const userEmail = 'aadisharma8441@gmail.com';
    // const projectName = functionInput.projectName;
    const userInput = functionInput.userInput;
    const instanceName = 'Dummy Instance Name'; // Needs to be changed
    const channel = functionInput.fromChannel;
    const user = functionInput.fromUser;
    const threadTs = functionInput.thread;
    const slackBotToken = functionInput.token;

    const userPrompt = `Your name is Plex. You are a helpful assistant with a good sense of humour. User has asked you for a joke. Respond to user's question with a unique and funny joke. Here is user's ask:${userInput}`;
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

    await this.sendMessage(channel, plexReply, threadTs, slackBotToken);

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
    try {
      const userId = functionInput.fromUser;
      const slackBotToken = functionInput.token;
      const teamId = functionInput.teamId;
      const blocks = functionInput.blocks;
      const userObject = await this.slackService.findUser(
        userId,
        slackBotToken,
      );
      const userName = userObject.user.real_name;
      const text = functionInput.userInput;
      const channelId = functionInput.fromChannel;
      const workspaceObject = await findWorkspace(teamId, slackBotToken);
      const workspace = workspaceObject.team.name;

      let channelName = '';
      console.log('original blocks', JSON.stringify(blocks));
      // Check if the message is from a direct message channel
      if (channelId.startsWith('D')) {
        channelName = 'Direct Message'; // Label direct message channels
      } else {
        const channelObject = await this.slackService.findChannelName(
          channelId,
          slackBotToken,
        );
        channelName = channelObject.channel.name;
      }

      const updatedText = await this.replaceUserIdsWithNames(
        text,
        slackBotToken,
      );
      console.log('text', text);
      console.log('updated text', updatedText);

      // const channelobject = await this.slackService.findChannelName(channelId,this.slackBotToken)
      // const channelName = channelobject.channel.name
      const timestamp = new Date(
        Number(functionInput.timestamp) * 1000,
      ).toLocaleString(); // Convert Slack timestamp
      const notificationMessage = `User ${userName} has sent a message to channel '${channelName}' on workspace '${workspace}':\n> '${updatedText}'\nAt: ${timestamp}`;
      const element = {
        type: 'rich_text_section',
        elements: [
          {
            type: 'text',
            text: notificationMessage,
          },
        ],
      };
      if (!Array.isArray(blocks[0].elements)) {
        blocks[0].elements = []; // Initialize blocks.elements as an array if undefined
      }

      // Add the element to the 0th index
      blocks[0].elements.unshift(element);
      console.log('notificationMessage', notificationMessage);
      console.log('blocks', JSON.stringify(blocks));
      console.log('elements', JSON.stringify(blocks[0].elements));
      await this.webhook.send({
        // text: notificationMessage,
        blocks: blocks,
      });
    } catch (error) {
      console.error('Error in slackNotification:', error);
      throw error; // Propagate the error to ensure visibility
    }
  }

  async sendTicketList(functionInput: any, context: KafkaContext) {
    const headers: OB1MessageHeader = context.getMessage()
      .headers as unknown as OB1MessageHeader;
    const messageKey = context.getMessage().key.toString();
    const instanceName = context.getMessage().headers.instanceName.toString();
    const destinationService = 'database-service';
    const sourceFunction = 'sendTicketList';
    const sourceType = 'service';
    const team_id = functionInput.team_id;
    const token = functionInput.token;
    const channelId = functionInput.fromChannel;

    const messageInput1 = {
      messageContent: {
        functionName: 'retrieveTickets', //retrieveTickets
        functionInput: {
          CRUDName: 'GET',
          CRUDInput: {
            tableEntity: 'OB1-tickets',
            teamId: team_id,
          },
        },
      },
    };
    const messageInputAdd1 = {
      messageType: 'REQUEST',
      ...messageInput1,
    };

    const response2 = await this.kafkaService.sendRequestSystem(
      messageKey,
      instanceName,
      destinationService,
      sourceFunction,
      sourceType,
      messageInputAdd1,
      headers.userRole.toString(),
      headers.userEmail.toString(),
    );

    console.log(
      'response from Database service for retrieving ticket',
      response2.messageContent,
    );

    let blocks;

    if (!response2.messageContent || response2.messageContent.length === 0) {
        blocks = [
            {
              type: 'section',
              block_id: 'radio_list',
              text: {
                type: 'mrkdwn',
                text: 'Please click on below to get started',
              },
              accessory: {
                type: 'radio_buttons',
                action_id: 'select_project',
                options: [
                    {
                    text: {
                        type: 'plain_text',
                        text: "Start a new project",
                      },
                      value: 'new_project',
                    },
                ],
                },
              },
          ];
    } else {
    const options = response2.messageContent.map((ticket) => ({
      text: {
        type: 'plain_text',
        text: ticket.ticketDescription,
      },
      value: ticket.ticketDescription,
    }));
    options.push({
      text: {
        type: 'plain_text',
        text: "No, It's a new project",
      },
      value: 'new_project',
    });

    blocks = [
      {
        type: 'section',
        block_id: 'radio_list',
        text: {
          type: 'mrkdwn',
          text: 'Sure. Before we move forward, can you confirm if this is related to any of the existing project from below list?',
        },
        accessory: {
          type: 'radio_buttons',
          action_id: 'select_project',
          options: options,
        },
      },
    ];
    }

    console.log('Blocks after appending ticket list', blocks);
    
    await this.postMessageToChannel(channelId, { blocks: blocks }, token);
    
    return {
      messageContent: {
        content: response2,
      },
    };
  }

  async replaceUserIdsWithNames(
    text: string,
    slackBotToken: string,
  ): Promise<string> {
    // Extract user IDs from the text
    const userIds = extractUserIds(text);

    // Map user IDs to real names
    const realNames = await Promise.all(
      userIds.map(async (userId) => {
        try {
          const userObject = await this.slackService.findUser(
            userId,
            slackBotToken,
          );
          return userObject?.user?.real_name || 'Unknown User';
        } catch (error) {
          console.error(`Error fetching user ${userId}:`, error);
          return 'Unknown User'; // Fallback for failed lookups
        }
      }),
    );

    // Replace each userId mention in the text with the corresponding real name
    let updatedText = text;
    userIds.forEach((userId, index) => {
      const mention = `<@${userId}>`; // Format of the mention
      const realName = realNames[index];
      updatedText = updatedText.replace(mention, realName);
    });

    return updatedText;
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
        functionName: 'LLMgenerateResponse-V1',
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

  private async sendMessage(
    channel: string,
    text: string,
    threadTs: string,
    slackBotToken: string,
  ) {
    try {
      const payload: any = { channel, text };
      if (threadTs) {
        payload.thread_ts = threadTs; // Include thread_ts if provided
      }
      await axios.post('https://slack.com/api/chat.postMessage', payload, {
        headers: {
          Authorization: `Bearer ${slackBotToken}`,
          'Content-Type': 'application/json',
        },
      });
      console.log('Reply sent', text);
    } catch (error) {
      console.error(
        'Error sending message:',
        error.response?.data || error.message,
      );
    }
  }

  private async postMessageToChannel(
    channel: string,
    message: { text?: string; blocks?: any[] },
    token: string,
  ): Promise<void> {
    try {
      const response = await axios.post(
        `${this.SLACK_BASE_URL}/chat.postMessage`,
        {
          channel: channel,
          text: message.text, // Fallback text for notifications or unsupported clients
          blocks: message.blocks, // Richly formatted blocks
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.data.ok) {
        throw new Error(`Failed to post message: ${response.data.error}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to post message to channel ${channel}:`,
        error.response?.data,
      );
      throw error;
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
