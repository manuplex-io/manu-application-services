import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios, { AxiosRequestConfig } from 'axios';
import { KafkaOb1Service } from 'src/kafka-ob1/kafka-ob1.service';
import { prompts } from './prompts';
import { KafkaContext } from '@nestjs/microservices';
import { IncomingWebhook } from '@slack/webhook';
import { createProjectMessageBlocks as createProjectBlocks } from './slack-utils';

interface SlackResponse {
  ok: boolean;
  error?: string;
  channel?: any;
  warning?: string;
  response_metadata?: {
    warnings: string[];
  };
  channels?: any
}

interface SlackUserResponse {
  ok: boolean;
  error?: string;
  user?: any;
  warning?: string;
  response_metadata?: {
    warnings: string[];
  };
  users?: any
}

@Injectable()
export class SlackChannelService {
  private readonly logger = new Logger(SlackChannelService.name);
  private readonly SLACK_BASE_URL = 'https://slack.com/api';

  constructor(
  private readonly kafkaOb1Service:KafkaOb1Service

  ){

  }
  /**
   * Creates a new Slack channel and joins it
   * @param channel - The name of the channel to create
   * @param token - The Slack bot token
   * @returns The created channel information
   * @throws HttpException if channel creation fails
   */
  async createAndJoinChannel(functionInput:{token:string,channel:string,userId:string}, context: KafkaContext) {
    const token = functionInput.token
    const channel = functionInput.channel
    const userId = functionInput.userId
    try {
        // First try to find if channel exists
        const existingChannel = await this.findChannel(channel, token);
        
        if (existingChannel.ok && existingChannel.channel) {
          this.logger.log(`Channel ${channel} exists. Attempting to join...`);
          const joinResponse = await this.joinChannel(existingChannel.channel.id, token);
          
          // Check if join was successful (even with warning)
          if (joinResponse.ok) {
            if (joinResponse.warning !== 'already_in_channel') {
              await this.inviteUserToChannel(existingChannel.channel.id, userId, token);
              // await this.postWelcomeMessage(existingChannel.channel.id, token, "consultant", "aadish@manuplex.io");
              await this.postNewWelcomeMessage(existingChannel.channel.id, token, userId);
            } else {
              this.logger.log(`Bot is already in channel ${channel}`);
            }
          }
          return joinResponse;
        }
  
        // If channel doesn't exist, create it
        const createdChannel = await this.createChannel(channel, token);
        
        if (createdChannel.ok && createdChannel.channel) {
          this.logger.log(`Channel ${channel} created successfully. Joining channel...`);
          const joinResponse = await this.joinChannel(createdChannel.channel.id, token);
          this.logger.log(`Channel ${channel} joined successfully ${joinResponse}`);
          console.log("joinResponse",joinResponse)
          if (!joinResponse.ok) {
            throw new Error(`Failed to join newly created channel: ${joinResponse.error}`);
          }

          this.logger.log(`Inviting user ${userId} to newly created channel ${channel}...`);
          await this.inviteUserToChannel(createdChannel.channel.id, userId, token);
          
          // Post welcome message for newly created channel
          // await this.postWelcomeMessage(createdChannel.channel.id, token, "consultant", "aadish@manuplex.io");
          await this.postNewWelcomeMessage(createdChannel.channel.id, token, userId);
  
          return {
            ok: true,
            channel: joinResponse.channel,
            message: 'Channel created and joined successfully'
          };
        }
  
        return createdChannel;
      } catch (error) {
        this.handleError(error, channel);
      }
  }


  async joinChannelBot(functionInput:{text:string,channel:string,response_url:string, token: string, userId:string}, context: KafkaContext) {
    
    const token = functionInput.token
    const {text,channel:channelId,response_url, userId} = functionInput
    try {
        // First try to find if channel exists
          const joinResponse = await this.joinChannel(channelId, token);
          // Check if join was successful (even with warning)
          console.log("joinResponse",joinResponse)
          if (joinResponse.ok) {
            if (joinResponse.warning !== 'already_in_channel') {
              // await this.postWelcomeMessage(channelId, token, "consultant", "aadish@manuplex.io");
              await this.postNewWelcomeMessage(channelId, token, userId);
            } else {
              this.sendMessage(response_url,"I am already here to assist you in your procurement process.")
              this.logger.log(`Bot is already in channel ${channelId}`);
            }
          }
          return joinResponse;
      } catch (error) {
        this.handleError(error, channelId);
      }
  }

   async findProjects(functionInput:{text:string,channel:string,response_url:string, token:string, teamId:string}, context: KafkaContext){
    try {
      const token = functionInput.token
    const {text,channel:channelId,response_url,teamId} = functionInput
    const userRole = 'consultant';
    const messageKey = 'aadish@manuplex.io';
    const instanceId = 'consultant';
    const destinationService = 'database-service';
    const sourceFunction = 'back-end';
    const sourceType = 'service';
    const messageInput1 = {
      messageContent: {
        functionName: 'retrieveTickets', //retrieveTickets
        functionInput: {
          CRUDName: 'GET',
          CRUDInput: {
            tableEntity: 'OB1-tickets',
            teamId: teamId,
          },
        },
      },
    };
    const messageInputAdd = {
      messageType: 'REQUEST',
      ...messageInput1,
    };

    // Check if the user has access to the provided instanceId
    const response = await this.kafkaOb1Service.sendRequestSystem(
      messageKey,
      instanceId,
      destinationService,
      sourceFunction,
      sourceType,
      messageInputAdd,
      userRole,
      messageKey,
    );

    const projects = response.messageContent; // Assuming this is an array of projects
    let slackMessage = {
      text: 'No Existing Projects', // Fallback text
      blocks:[]
    };
    console.log("projects", projects);
    if (Array.isArray(projects) && projects.length > 0) {
      const blocks = createProjectBlocks(projects);
      console.log("blocks", blocks);
      slackMessage = {
        text: 'Here is the list of projects.', 
        blocks, // Richly formatted blocks
      };
    }
    await this.postMessageToChannel(channelId, slackMessage, token);
    return response;
    } catch (error) {
      console.log("error in findProjects",error)
    }
  }


  async sendMessage(webhookUrl: string, message: string): Promise<void> {
    const webhook = new IncomingWebhook(webhookUrl);

    try {
      await webhook.send({
        text: message,
      });
    } catch (error) {
      console.error('Error sending message to Slack:', error);
      throw new Error('Failed to send message to Slack');
    }
  }


  /**
 * Invites a user to a Slack channel
 * @param channelId - The ID of the channel
 * @param userId - The ID of the user to invite
 * @param token - The Slack bot token
 * @throws Error if the invite fails (except when user is already in the channel)
 */
async inviteUserToChannel(channelId: string, userId: string, token: string) {
   
    try {
        const response = await axios.post<SlackResponse>(
            `${this.SLACK_BASE_URL}/conversations.invite`,
            {
              channel: channelId,
              users: userId,
            },
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }
          );
      
        // Check if response indicates the user is already in the channel
        if (!response.data.ok) {
          if (response.data.error === 'already_in_channel') {
            this.logger.log(`User ${userId} is already in channel ${channelId}. No need to re-invite.`);
            return; // Do not throw an error, simply return
          }
      
          // Handle other errors
          throw new Error(`Failed to invite user ${userId} to channel ${channelId}: ${response.data.error}`);
        }
        this.logger.log(`User ${userId} invited to channel ${channelId} successfully.`);
        
    } catch (error) {
        this.logger.error(`Failed to invite to channel ${channelId}:`, error.response?.data);
        throw error
    }
    
  }
  

  /**
   * Finds a channel by name
   * @private
   */
  async findChannel(channel: string, token: string): Promise<SlackResponse> {
    try {
      const response = await axios.get<SlackResponse>(
        `${this.SLACK_BASE_URL}/conversations.list`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          params: {
            types: 'public_channel',
            exclude_archived: true,
          },
        }
      );

      if (response.data.ok) {
        const channels = response.data.channels || [];
        const foundChannel = channels.find(ch => ch.name === channel);
        return {
          ok: true,
          channel: foundChannel,
        };
      }
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to find channel ${channel}:`, error.response?.data);
      throw error;
    }
  }

  async findUser(user: string, token: string): Promise<SlackUserResponse> {
    try {
      const response = await axios.get<SlackUserResponse>(
        `${this.SLACK_BASE_URL}/users.info`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          params: {
            user: user,
          },
        }
      );
       return response.data;
    } catch (error) {
      this.logger.error(`Failed to find user ${user}:`, error.response?.data);
      throw error;
    }
  }

  async findChannelName(channel: string, token: string): Promise<SlackResponse> {
    try {
      const response = await axios.get<SlackResponse>(
        `${this.SLACK_BASE_URL}/conversations.info`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          params: {
            channel: channel,
          },
        }
      );
       return response.data;
    } catch (error) {
      this.logger.error(`Failed to find channel ${channel}:`, error.response?.data);
      throw error;
    }
  }


  /**
   * Posts welcome message to the channel using LLM
   * @private
   */
  // private async postWelcomeMessage(
  //   channel: string,
  //   token: string,
  //   userRole: string,
  //   userEmail: string,
  // ): Promise<void> {
  //   try {
  //     // Call LLM to generate welcome message
  //     this.logger.log(`calling llm`);
  //     const llmResponse = await this.callLLM(
  //       'You are a helpful assistant that generates welcome messages for Slack channels.',
  //       prompts.slackJoin,
  //       "",
  //       userRole,
  //       userEmail,
  //       userEmail,
  //       userRole,
  //     );
  //     this.logger.log(`llmResponse ${llmResponse}`);
  //     // Post the message to the channel
  //     await this.postMessageToChannel(channel, {text:llmResponse.messageContent.content}, token);

  //     this.logger.log(`Successfully posted welcome message to channel: ${channel}`);
  //   } catch (error) {
  //     this.logger.error(`Failed to post welcome message to channel ${channel}:`, error);
  //     throw new Error(`Failed to post welcome message: ${error.message}`);
  //   }
  // }

  private async postNewWelcomeMessage(
    channel: string,
    token: string,
    userId: string,
  ): Promise<void> {
    const userObject = await this.findUser(
      userId,
      token,
    );
    const userName = userObject.user.real_name;
    try {
      // Fixed welcome message
      const welcomeMessage = [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:tada: Hi ${userName}! I'm Plex, your AI-powered assistant for all things hardware!\n\nI’m here to help you streamline your work—whether it’s finding suppliers, preparing RFQs, or solving complex challenges. Let me show you what I can do!`,
          },
        },
        // Section 1: For any hardware-related requirement
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*To ask me anything:*\nTag me \`@plex-dev-2\` and ask anything to get started. Try from the below options or type anything you want:`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "<@plex-dev-2> *What are the various ASTM grades for steel?*",
          },
          accessory: {
            type: "button",
            text: {
              type: "plain_text",
              text: "Click to Ask",
            },
            action_id: "ask_astm_grades",
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "<@plex-dev-2> *Help me find a CNC machinist who does small orders.*",
          },
          accessory: {
            type: "button",
            text: {
              type: "plain_text",
              text: "Click to Ask",
            },
            action_id: "ask_cnc_machinist",
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "<@plex-dev-2> *Help me find an alternative to a PCB connector.*",
          },
          accessory: {
            type: "button",
            text: {
              type: "plain_text",
              text: "Click to Ask",
            },
            action_id: "ask_pcb_connector",
          },
        },
        // Section 2: For checking what I am working on
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*To check my current tasks:*\nType \`/whatsupPlex\` to see what I am working on.`,
          },
        },
        // Section 3: For inviting me to join a channel
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*To invite me to a channel:*\nType \`/joinhere\` to add me to any Slack channel.`,
          },
        },
      ];
  
      // Post the message to the channel
      await this.postMessageToChannel(channel, {
        blocks: welcomeMessage,
        text: ''
      }, token);
  
      this.logger.log(`Successfully posted new welcome message to channel: ${channel}`);
    } catch (error) {
      this.logger.error(`Failed to post new welcome message to channel ${channel}:`, error);
      throw new Error(`Failed to post new welcome message: ${error.message}`);
    }
  }
  

  /**
   * Posts a message to a Slack channel
   * @private
   */
  private async postMessageToChannel(
    channel: string,
    message: { text: string; blocks?: any[] },
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
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.data.ok) {
        throw new Error(`Failed to post message: ${response.data.error}`);
      }
    } catch (error) {
      this.logger.error(`Failed to post message to channel ${channel}:`, error.response?.data);
      throw error;
    }
  }

  /**
   * Creates a new Slack channel
   * @private
   */
  private async createChannel(channel: string, token: string): Promise<SlackResponse> {
    try {
      const response = await axios.post<SlackResponse>(
        `${this.SLACK_BASE_URL}/conversations.create`,
        { name: channel },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.ok) {
        this.logger.log(`Successfully created channel: ${channel}`);
      }

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to create channel ${channel}:`, error.response?.data);
      throw error;
    }
  }

  /**
   * Joins an existing Slack channel
   * @private
   */
  private async joinChannel(channel: string, token: string): Promise<SlackResponse> {
    try {
      const data = new URLSearchParams({ channel });

    const config: AxiosRequestConfig = {
      method: 'post',
      url: `${this.SLACK_BASE_URL}/conversations.join`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data,
    };
    const response = await axios.request(config);

      if (response.data.ok) {
        this.logger.log(`Successfully joined channel: ${channel}`);
      }

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to join channel ${channel}:`, error.response?.data);
      throw error;
    }
  }

  /**
   * Handles errors from Slack API calls
   * @private
   */
  private handleError(error: any, channel: string): never {
    const errorResponse = error.response?.data;
    const errorMessage = errorResponse?.error || 'Unknown error occurred';
    
    console.log("error",error)
    this.logger.error(`Slack API error for channel ${channel}:`, {
      error: errorMessage,
      details: errorResponse,
    });

    throw new HttpException(
      {
        status: HttpStatus.BAD_REQUEST,
        error: `Failed to process channel operation: ${errorMessage}`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }

  async callLLM(
    systemPrompt:string,
    userPrompt: string,
    responseFormat,
    userRole: string,
    userEmail: string,
    messageKey: string,
    instanceName: string,
  ) {
    const destinationService = 'agent-services';
    const sourceFunction = 'createAndJoinChannel';
    const sourceType = 'service';
    const messageInput = {
      messageContent: {
        functionName: 'LLMgenerateResponse-V1',
        functionInput: {
          systemPrompt:systemPrompt,
          userPrompt: userPrompt,
          responseFormat: responseFormat,
          config: {
            provider: 'openai',
            model: 'gpt-4o-mini',
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

    const response = await this.kafkaOb1Service.sendRequest(
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
}