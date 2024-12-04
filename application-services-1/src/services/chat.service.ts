import { Injectable, Logger } from '@nestjs/common';
import { KafkaContext } from '@nestjs/microservices';
import {
  getChannelMessageHistory,
  getThreadMessageHistory,
  deleteSlackMessage,
} from './slack-utils';
import { OB1MessageHeader } from 'src/interfaces/ob1-message.interfaces';
import { KafkaOb1Service } from 'src/kafka-ob1/kafka-ob1.service';
import {
  CRUDOperationName,
  CRUDRequest,
} from 'src/kafka-ob1/interfaces/CRUD.interfaces';
import { CRUDPromptRoute } from 'src/kafka-ob1/interfaces/promptCRUD.interfaces';
import axios from 'axios';
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly SLACK_BASE_URL = 'https://slack.com/api';
  private readonly JIRA_BASE_URL = 'https://manuplex-team.atlassian.net'
  constructor(private kafkaService: KafkaOb1Service) {}

  async chatWithUser(functionInput: any, context: KafkaContext) {
    const messageKey = context.getMessage().key.toString();
    const instanceName = context.getMessage().headers.instanceName.toString();
    const headers: OB1MessageHeader = context.getMessage()
      .headers as unknown as OB1MessageHeader;

    try {
      const {
        token,
        userId,
        channelId,
        projectName,
        threadId,
        userInput,
        teamId,
      } = functionInput;
      let messages: { role: string; content: string }[] = [];
      let userInput1 = userInput;
      let threadId1 = threadId;
      if (threadId1) {
        // Fetch conversation history for the given threadId
        const threadMessages = await getThreadMessageHistory(
          channelId,
          threadId,
          token,
        );

        // Transform the messages into the required JSON format
        messages = threadMessages.map((message) =>
          message.user === userId
            ? { role: 'user', content: message.text }
            : { role: 'assistant', content: message.text },
        );
      } else {
        // No threadId: Fetch channel messages to find the latest user message
        const channelMessages = await getChannelMessageHistory(
          channelId,
          token,
        );

        const timestampToBeDeleted = channelMessages[0].ts;

        await deleteSlackMessage(channelId, timestampToBeDeleted, token);

        const latestMessage = channelMessages.find(
          (message) => message.user === userId,
        );
        threadId1 = latestMessage.ts;

        if (!latestMessage) {
          throw Error('No latest message found for the user');
        }

        // Use this message as the starting point
        userInput1 = latestMessage.text;
      }

      // Define the executeDto with the conversation history
      const executeDto = {
        userPromptVariables: {
          userInput: userInput1,
        },
        messageHistory: messages, // Pass the transformed history
        llmConfig: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          temperature: 0.7,
        },
      };

      const CRUDFunctionInput = {
        CRUDOperationName: CRUDOperationName.POST,
        CRUDRoute: CRUDPromptRoute.EXECUTE_WITHOUT_USER_PROMPT,
        CRUDBody: executeDto,
        routeParams: { promptId: '6def9705-2456-4c9c-80d9-f5a19e25f657' },
      }; //CRUDFunctionInput

      const request: CRUDRequest = {
        messageKey, //messageKey
        userOrgId: instanceName || 'default', //instanceName
        sourceFunction: 'executePromptWithUserPrompt', //sourceFunction
        CRUDFunctionNameInput: 'promptCRUD-V1', //CRUDFunctionNameInput
        CRUDFunctionInput, //CRUDFunctionInput
        personRole: headers.userRole.toString() || 'user', // userRole
        personId: headers.userEmail.toString(), // userEmail
      };

      const response = await this.kafkaService.sendAgentCRUDRequest(request);
      console.log('response from llm', response.messageContent);

      const parsedMessage = JSON.parse(response.messageContent.content);
      const plexMessage = parsedMessage.Response;

      const { Ticket_ID, Ticket_Title } = parsedMessage;
      if (Ticket_ID && Ticket_Title) {
        await this.createTicket(
          Ticket_ID,
          Ticket_Title,
          teamId,
          threadId1,
          context,
          channelId,
        );
        console.log('ticket created');
      }

      // Append the bot's response to the history
      if (!threadId) {
        messages.push({ role: 'user', content: userInput1 });
      }
      messages.push({ role: 'assistant', content: plexMessage });

      // Save the updated conversation history
      await this.appendConversation(threadId1, context, messages);

      // Post the bot's response to the thread
      await this.postMessageToChannel(
        channelId,
        { text: plexMessage },
        token,
        threadId1, // Post the message in the thread
      );

      return { ...response.messageContent };
    } catch (error) {
      this.logger.error(`error ${error}`);
      throw Error(error);
    }
  }

  async onboardUser(functionInput: any, context: KafkaContext) {
    const { token, userId, channelId, userInput, teamId } =
      functionInput;
    const messageKey = context.getMessage().key.toString();
    const instanceName = context.getMessage().headers.instanceName.toString();
    const headers: OB1MessageHeader = context.getMessage()
      .headers as unknown as OB1MessageHeader;

      let message = ''
    if (userInput === 'What are the various ASTM grades for steel?') { 
    message = `Sure, let me help you in finding some ASTM grades for steel`
  } else if (userInput === 'Help me find an alternative to a PCB connector.'){
    message = `Sure, let me help you in finding some alternatives to the PCB connector`
  } else if (userInput === 'Help me find a CNC machinist who does small orders.') {
    message = `Sure, let me help in finding a CNC machinist that fulfills your requirement`
  }
    const data = await this.postMessageToChannel(
        channelId,
        { text:message  },
        token,
      );
    const threadId = data.ts
    try {
      const executeDto = {
        userPromptVariables: {
          userInput: "",
        },
        messageHistory: [{ role: 'user', content: userInput },{ role: 'assistant', content: message }], // Pass the transformed history
        llmConfig: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          temperature: 0.7,
        },
      };

      const CRUDFunctionInput = {
        CRUDOperationName: CRUDOperationName.POST,
        CRUDRoute: CRUDPromptRoute.EXECUTE_WITHOUT_USER_PROMPT,
        CRUDBody: executeDto,
        routeParams: { promptId: '6def9705-2456-4c9c-80d9-f5a19e25f657' },
      }; //CRUDFunctionInput

      const request: CRUDRequest = {
        messageKey, //messageKey
        userOrgId: instanceName || 'default', //instanceName
        sourceFunction: 'executePromptWithUserPrompt', //sourceFunction
        CRUDFunctionNameInput: 'promptCRUD-V1', //CRUDFunctionNameInput
        CRUDFunctionInput, //CRUDFunctionInput
        personRole: headers.userRole.toString() || 'user', // userRole
        personId: headers.userEmail.toString(), // userEmail
      };

      const response = await this.kafkaService.sendAgentCRUDRequest(request);
      console.log('response from llm', response.messageContent);

      const parsedMessage = JSON.parse(response.messageContent.content);
      const plexMessage = parsedMessage.Response;

      await this.postMessageToChannel(
        channelId,
        { text: plexMessage },
        token,
        threadId, // Post the message in the thread
      );

      return { ...response.messageContent };
    } catch (error) {
      this.logger.error(`error in onboardUser function ${error}`);
      throw error;
    }
  }

  async handleAgentResponse(functionInput:any, context:KafkaContext){

    const {ticketId,comment,displayName} = functionInput

    try {

      const messageHistory = await this.agentPlexHistory(ticketId)
      console.log("messageHistory",messageHistory)
      
    } catch (error) {
      this.logger.error(`error in handleAgentResponse Function ${JSON.stringify(error)}`)
    }


  }

  async createTicket(
    ticketId: string,
    ticketDescription: string,
    teamId: string,
    threadId: any,
    context: KafkaContext,
    channelId: string,
  ) {
    try {
      const headers: OB1MessageHeader = context.getMessage()
        .headers as unknown as OB1MessageHeader;
      const messageKey = context.getMessage().key.toString();
      const instanceName = context.getMessage().headers.instanceName.toString();
      const destinationService = 'database-service';
      const sourceFunction = 'addMessage';
      const sourceType = 'service';

      const messageInput1 = {
        messageContent: {
          functionName: 'retrieveTickets', //retrieveTickets
          functionInput: {
            CRUDName: 'CREATE',
            CRUDInput: {
              tableEntity: 'OB1-tickets',
              threadId: threadId,
              ticketId: ticketId,
              ticketDescription: ticketDescription,
              creator: teamId,
            },
          },
        },
      };
      const messageInputAdd1 = {
        messageType: 'REQUEST',
        ...messageInput1,
      };

      const response = await this.kafkaService.sendRequestSystem(
        messageKey,
        instanceName,
        destinationService,
        sourceFunction,
        sourceType,
        messageInputAdd1,
        headers.userRole.toString(),
        headers.userEmail.toString(),
      );
    } catch (error) {
      throw Error(`error in creating Ticket function ${error}`);
    }
  }

  async appendConversation(
    threadId: string,
    context: KafkaContext,
    messages: any[],
  ) {
    try {
      const headers: OB1MessageHeader = context.getMessage()
        .headers as unknown as OB1MessageHeader;
      const messageKey = context.getMessage().key.toString();
      const instanceName = context.getMessage().headers.instanceName.toString();
      const destinationService = 'database-service';
      const sourceFunction = 'addMessage';
      const sourceType = 'service';

      const messageInput1 = {
        messageContent: {
          functionName: 'createupdateThread', //retrieveTickets
          functionInput: {
            CRUDName: 'CREATE',
            CRUDInput: {
              tableEntity: 'OB1-threadMessage',
              threadId: threadId,
              conversation: messages,
            },
          },
        },
      };
      const messageInputAdd1 = {
        messageType: 'REQUEST',
        ...messageInput1,
      };

      const response = await this.kafkaService.sendRequestSystem(
        messageKey,
        instanceName,
        destinationService,
        sourceFunction,
        sourceType,
        messageInputAdd1,
        headers.userRole.toString(),
        headers.userEmail.toString(),
      );
    } catch (error) {
      throw Error(`error in append Conversation function ${error}`);
    }
  }
  private async postMessageToChannel(
    channel: string,
    message: { text?: string; blocks?: any[] },
    token: string,
    thread_ts?: string,
  ) {
    try {
      const response = await axios.post(
        `${this.SLACK_BASE_URL}/chat.postMessage`,
        {
          channel: channel,
          text: message.text, // Fallback text for notifications or unsupported clients
          blocks: message.blocks, // Richly formatted blocks
          thread_ts: thread_ts,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data

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

  async agentPlexHistory(ticketId:string){
    console.log("url",`${this.JIRA_BASE_URL}/rest/api/2/issue/${ticketId}/comment`)
    console.log("env",`${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN}`)
    try {
      const response = await axios.get(`${this.JIRA_BASE_URL}/rest/api/2/issue/${ticketId}/comment`,
       {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN}`
          ).toString('base64')}`,
          'Accept': 'application/json'
        }
       }
      )
      if (response && response.data && response.data.comments) {
        const transformedComments = response.data.comments.map((comment) => ({
          role: comment.author?.displayName, 
          content: comment.body,
        }));
        console.log(transformedComments);
        return transformedComments;
    }
  } 
  catch (error) {
      this.logger.error(`error in agentPlexHistory ${JSON.stringify(error)}`)
      throw error
    }
  }
}
