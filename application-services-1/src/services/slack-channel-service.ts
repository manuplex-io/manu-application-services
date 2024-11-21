import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import { KafkaOb1Service } from 'src/kafka-ob1/kafka-ob1.service';
import { prompts } from './prompts';
import { KafkaContext } from '@nestjs/microservices';

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
              await this.postWelcomeMessage(existingChannel.channel.id, token, "consultant", "aadish@manuplex.io");
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
          await this.postWelcomeMessage(createdChannel.channel.id, token, "consultant", "aadish@manuplex.io");
  
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


  async joinChannelBot(functionInput:{text:string,channel:string,response_url:string}, context: KafkaContext) {
    const token = process.env.slack_token
    const channelId = functionInput.channel
    try {
        // First try to find if channel exists
          const joinResponse = await this.joinChannel(channelId, token);
          // Check if join was successful (even with warning)
          if (joinResponse.ok) {
            if (joinResponse.warning !== 'already_in_channel') {
              await this.postWelcomeMessage(channelId, token, "consultant", "aadish@manuplex.io");
            } else {
              this.logger.log(`Bot is already in channel ${channelId}`);
            }
          }
          return joinResponse;
      } catch (error) {
        this.handleError(error, channelId);
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
  private async findChannel(channel: string, token: string): Promise<SlackResponse> {
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


  /**
   * Posts welcome message to the channel using LLM
   * @private
   */
  private async postWelcomeMessage(
    channel: string,
    token: string,
    userRole: string,
    userEmail: string,
  ): Promise<void> {
    try {
      // Call LLM to generate welcome message
      this.logger.log(`calling llm`);
      const llmResponse = await this.callLLM(
        'You are a helpful assistant that generates welcome messages for Slack channels.',
        prompts.slackJoin,
        "",
        userRole,
        userEmail,
        userEmail,
        userRole,
      );
      this.logger.log(`llmResponse ${llmResponse}`);
      // Post the message to the channel
      await this.postMessageToChannel(channel, llmResponse.messageContent.content, token);

      this.logger.log(`Successfully posted welcome message to channel: ${channel}`);
    } catch (error) {
      this.logger.error(`Failed to post welcome message to channel ${channel}:`, error);
      throw new Error(`Failed to post welcome message: ${error.message}`);
    }
  }

  /**
   * Posts a message to a Slack channel
   * @private
   */
  private async postMessageToChannel(
    channel: string,
    message: string,
    token: string,
  ): Promise<void> {
    try {
      const response = await axios.post(
        `${this.SLACK_BASE_URL}/chat.postMessage`,
        {
          channel: channel,
          text: message,
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
      const response = await axios.post<SlackResponse>(
        `${this.SLACK_BASE_URL}/conversations.join`,
        { channel: channel },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

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
        functionName: 'LLMgenerateResponse',
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