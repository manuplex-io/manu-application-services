import { Body, Injectable, Logger } from '@nestjs/common';
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
import { SlackEventHandlingService } from './slack-event-handling.service';
import {getAttachmentUrlFromComment} from './jira-utils'
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly SLACK_BASE_URL = 'https://slack.com/api';
  private readonly JIRA_BASE_URL = 'https://manuplex-team.atlassian.net';
  constructor(
    private kafkaService: KafkaOb1Service,
    private slackEventHandlingService: SlackEventHandlingService,
  ) {}

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
        
        const response =   await this.getTicketDetailsByThreadId(threadId);
        
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
        messages.pop()
        if (response) {
          const {ticketId,ticketDescription} = response
          console.log("calling chatAfterTicketCreation", ticketId)
          await this.chatAfterTicketCreation(
            functionInput,
            ticketId,
            ticketDescription,
            context,
            messages,
          );
          return;
        }
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

  async existingProject(functionInput: any, context: KafkaContext) {
    
    const {
      token,
      userId,
      channelId,
      projectName,
      userInput,
      teamId,
    } = functionInput;

    try {

      const {threadId,ticketDescription} = await this.slackEventHandlingService.getSlackDetails(projectName)

      console.log(`existing project ${projectName} ${threadId}`)


      const threadMessages = await getThreadMessageHistory(
        channelId,
        threadId,
        token,
      );

      // Transform the messages into the required JSON format
      const messages = threadMessages.map((message) =>
        message.user === userId
          ? { role: 'user', content: message.text }
          : { role: 'assistant', content: message.text },
      );
      const channelMessages = await getChannelMessageHistory(channelId, token);

      const timestampToBeDeleted = channelMessages[0].ts;

      await deleteSlackMessage(channelId, timestampToBeDeleted, token);

      const latestMessage = channelMessages.find(
        (message) => message.user === userId,
      );

      const userInput = latestMessage.text

      if (!userInput) {
        throw Error('No latest message found for the user');
      }


      const newFunctionInput = {...functionInput, threadId,userInput}
      console.log("newFunctionInput",newFunctionInput)

      await this.chatAfterTicketCreation(newFunctionInput,projectName,ticketDescription,context,messages)

    } catch (error) {
      this.logger.error(`error in function existing project ${JSON.stringify(error)}`)
    }
  }

  async chatAfterTicketCreation(
    functionInput: any,
    ticketId: string,
    ticketDescription:string,
    context: KafkaContext,
    messages?: any[],
  ) {
    const {
      token,
      userId,
      channelId,
      projectName,
      threadId,
      userInput,
      teamId,
    } = functionInput;

    const messageKey = context.getMessage().key.toString();
    const instanceName = context.getMessage().headers.instanceName.toString();
    const headers: OB1MessageHeader = context.getMessage()
      .headers as unknown as OB1MessageHeader;

    try {
      // const ticketDetails = await this.agentPlexHistory(ticketId);
      // console.log("ticketDetails",ticketDetails)
      const executeDto = {
        systemPromptVariables: {
          taskDescription: ticketDescription,
        },
        userPromptVariables: {
          userInput: userInput,
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
        routeParams: { promptId: 'c26bf9e3-ce1b-4824-9767-dd3b44c51b17' },
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
      // await this.postJiraComment(ticketId)

      const llmResponse = JSON.parse(response.messageContent.content);
      console.log('llmResponse', llmResponse);
      if (Array.isArray(llmResponse?.Messages)) {
        const Manager = llmResponse.Messages.find(
          (element) => element.Recipient === 'manager',
        );
        const Consultant = llmResponse.Messages.find(
          (element) => element.Recipient === 'consultant',
        );

        if (Manager) {
          await this.postMessageToChannel(
            channelId,
            { text: Manager.Message },
            token,
            threadId,
          );
        }

        if (Consultant) {
          // Corrected condition
          await this.postJiraComment(ticketId, Consultant.Message);
        }
      } else {
        console.log('llm response did not return array');
      }
    } catch (error) {
      console.log('error', error);
      this.logger.error(
        `error in chatAfterTicketCreation Function ${JSON.stringify(error)}`,
      );
    }
  }

  async onboardUser(functionInput: any, context: KafkaContext) {
    const { token, userId, channelId, userInput, teamId } = functionInput;
    const messageKey = context.getMessage().key.toString();
    const instanceName = context.getMessage().headers.instanceName.toString();
    const headers: OB1MessageHeader = context.getMessage()
      .headers as unknown as OB1MessageHeader;

    let message = '';
    if (userInput === 'What are the various ASTM grades for steel?') {
      message = `Sure, let me help you in finding some ASTM grades for steel`;
    } else if (
      userInput === 'Help me find an alternative to a PCB connector.'
    ) {
      message = `Sure, let me help you in finding some alternatives to the PCB connector`;
    } else if (
      userInput === 'Help me find a CNC machinist who does small orders.'
    ) {
      message = `Sure, let me help in finding a CNC machinist that fulfills your requirement`;
    }
    const data = await this.postMessageToChannel(
      channelId,
      { text: message },
      token,
    );
    const threadId = data.ts;
    try {
      const executeDto = {
        userPromptVariables: {
          userInput: '',
        },
        messageHistory: [
          { role: 'user', content: userInput },
          { role: 'assistant', content: message },
        ], // Pass the transformed history
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

  async handleAgentResponse(functionInput: any, context: KafkaContext) {
    const messageKey = context.getMessage().key.toString();
    const instanceName = context.getMessage().headers.instanceName.toString();
    const headers: OB1MessageHeader = context.getMessage()
      .headers as unknown as OB1MessageHeader;

    const { ticketId, comment, displayName } = functionInput;

    try {
      const slackDetails = await this.slackEventHandlingService.getSlackDetails(ticketId);
      const { slackToken, channelId, threadId } = slackDetails;
      const fileContentUrl = await getAttachmentUrlFromComment(ticketId,comment)
      console.log("comment",comment)
      console.log("fileContentUrl",fileContentUrl)
      const ticketDetails = await this.agentPlexHistory(ticketId);
      let executeDto = {}
      if(fileContentUrl){
        executeDto = {
        systemPromptVariables: {
          taskDescription: ticketDetails.description,
        },
        userPromptVariables: {
          consultantMessage: comment,
          botToken:slackToken,
          channelId:channelId,
          threadId:threadId,
          fileUrl:fileContentUrl
        },
        messageHistory: ticketDetails.comments, // Pass the transformed history
        llmConfig: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          temperature: 0.7,
        },
      };
      }
      else{
        // console.log("ticketDetails",ticketDetails)
       executeDto = {
        systemPromptVariables: {
          taskDescription: ticketDetails.description,
        },
        userPromptVariables: {
          consultantMessage: comment,
        },
        messageHistory: ticketDetails.comments, // Pass the transformed history
        llmConfig: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          temperature: 0.7,
        },
      };
      }

      const CRUDFunctionInput = {
        CRUDOperationName: CRUDOperationName.POST,
        CRUDRoute: CRUDPromptRoute.EXECUTE_WITHOUT_USER_PROMPT,
        CRUDBody: executeDto,
        routeParams: { promptId: 'f8dd202a-a4f6-489e-9e49-680d8aeb7789' },
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
      // await this.postJiraComment(ticketId)

      const llmResponse = JSON.parse(response.messageContent.content);
      console.log('llmResponse', llmResponse);
      if (Array.isArray(llmResponse?.Messages)) {
        const managerMessages = llmResponse.Messages.filter(
          (element) => element.Recipient === 'manager',
        );
        const consultantMessages = llmResponse.Messages.filter(
          (element) => element.Recipient === 'consultant',
        );
      
        if (managerMessages.length > 0) {
          
      
          for (const message of managerMessages) {
            await this.postMessageToChannel(
              channelId,
              { text: message.Message },
              slackToken,
              threadId,
            );
          }
        }
      
        if (consultantMessages.length > 0) {
          for (const message of consultantMessages) {
            await this.postJiraComment(ticketId, message.Message);
          }
        }
      } else {
        console.log('llm response did not return array');
      }
    } catch (error) {
      console.log('error', error);
      this.logger.error(
        `error in handleAgentResponse Function ${JSON.stringify(error)}`,
      );
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
              channelId: channelId,
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

      return response.data;

    } catch (error) {
      this.logger.error(
        `Failed to post message to channel ${channel}:`,
        error.response?.data,
      );
      throw error;
    }
  }

  async agentPlexHistory(ticketKey: string) {
    console.log('url', `${this.JIRA_BASE_URL}/rest/api/2/issue/${ticketKey}`);
    console.log('env', `${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN}`);
    try {
      const response = await axios.get(
        `${this.JIRA_BASE_URL}/rest/api/2/issue/${ticketKey}`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(
              `${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN}`,
            ).toString('base64')}`,
            Accept: 'application/json',
          },
        },
      );

      if (response && response.data) {
        // Extract key information from the ticket
        const ticketDetails = {
          description:
            response.data.fields?.description || 'No description available',
            comments:
            response.data.fields?.comment?.comments
              .map((comment) => ({
                role: comment.author?.displayName === 'Plex' ? 'assistant' : 'user',
                content: comment.body,
              })) || [],
          status: response.data.fields?.status?.name,
          priority: response.data.fields?.priority?.name,
          summary: response.data.fields?.summary,
          created: response.data.fields?.created,
          updated: response.data.fields?.updated,
        };

        return ticketDetails;
      }
    } catch (error) {
      this.logger.error(`error in agentPlexHistory ${JSON.stringify(error)}`);
      throw error;
    }
  }

  async postJiraComment(ticketId: string, messsage: string) {
    try {
      const response = await axios.post(
        `${this.JIRA_BASE_URL}/rest/api/2/issue/${ticketId}/comment`,
        { body: messsage },
        {
          headers: {
            Authorization: `Basic ${Buffer.from(
              `${process.env.JIRA_PLEX_EMAIL}:${process.env.JIRA_PLEX_TOKEN}`,
            ).toString('base64')}`,
            Accept: 'application/json',
          },
        },
      );
      return response.data;
    } catch (error) {
      this.logger.error(`error in postJiraComment ${JSON.stringify(error)}`);
      throw Error(`error in postJiraComment ${JSON.stringify(error)}`);
    }
  }

  async getTicketDetailsByThreadId(threadId: string) {
    try {
      // const headers: OB1MessageHeader = context.getMessage()
      // .headers as unknown as OB1MessageHeader;
      const messageKey = 'aadish@manuplex.io';
      // const messageKey = context.getMessage().key.toString();
      const instanceId = 'consultant';
      const userRole = 'consultant';
      const destinationService = 'database-service';
      const sourceFunction = 'getSlackDetails';
      const sourceType = 'service';

      const messageInput = {
        messageContent: {
          functionName: 'retrieveTickets',
          functionInput: {
            CRUDName: 'GET',
            CRUDInput: {
              tableEntity: 'OB1-tickets',
              threadId: threadId,
            },
          },
        },
      };
      const messageInputAdd = {
        messageType: 'REQUEST',
        ...messageInput,
      };

      const response = await this.kafkaService.sendRequestSystem(
        messageKey,
        instanceId,
        destinationService,
        sourceFunction,
        sourceType,
        messageInputAdd,
        userRole,
        messageKey,
      );

      console.log(
        'response from Database service for retrieving slack details',
        response.messageContent,
      );

      const content = response.messageContent;
      if(content){
        const { ticketDescription, ticketId } = content
        return {
          ticketDescription,
          ticketId,
        };
      }
      else{
        return null
      }

      
    } catch (error) {
      console.error('Error sending response to Slack:', error.message);
    }
  }
}

