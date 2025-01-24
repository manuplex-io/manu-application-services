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
import { ChatService } from './chat.service';
import { getAttachmentUrlFromComment } from './jira-utils';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as FormData from 'form-data';

@Injectable()
export class ConfluenceService {
  private readonly logger = new Logger(ConfluenceService.name);
  private readonly SLACK_BASE_URL = 'https://slack.com/api';
  private readonly JIRA_BASE_URL = 'https://manuplex-team.atlassian.net';
  constructor(
    private kafkaService: KafkaOb1Service,
    private chatService: ChatService,
  ) {}

  async getConfluencePages(functionInput: any, context: KafkaContext) {
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

      const { jiraEmail, jiraToken, jiraBaseUrl } = await this.getTeamData(
        userId,
        teamId,
      );

      // Check for Slack file uploads and handle them
      const fileUrls =
        await this.chatService.checkSlackFileUploads(functionInput);
      this.logger.log('Files uploaded by the user:', fileUrls);

      if (threadId1) {
        const response = await this.chatService.getTicketDetailsByThreadId(
          threadId,
          context,
        );
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
        messages.pop();
        if (response) {
          const { ticketId, ticketDescription } = response;
          this.logger.log('calling chatAfterTicketCreation', ticketId);
          await this.chatService.chatAfterTicketCreation(
            functionInput,
            ticketId,
            ticketDescription,
            context,
            messages,
            fileUrls,
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

      //   const toolENVInputVariables = {
      //     ticketId: "PPT-2",
      //     botToken: token,
      //     jiraPlexEmail: process.env.JIRA_PLEX_EMAIL,
      //     jiraPlexToken: process.env.JIRA_PLEX_TOKEN,
      //     fileUrl: fileUrls ? fileUrls: [],
      //   }

      const toolENVInputVariables = {
        jiraEmail: jiraEmail,
        jiraToken: jiraToken,
        jiraBaseUrl: jiraBaseUrl,
      };

      // Define the executeDto with the conversation history
      const executeDto = {
        userPromptVariables: {
          userInput: userInput1,
          //   fileUrl: fileUrls ? fileUrls: "",
        },
        toolENVInputVariables,
        messageHistory: messages, // Pass the transformed history
      };

      const CRUDFunctionInput = {
        CRUDOperationName: CRUDOperationName.POST,
        CRUDRoute: CRUDPromptRoute.EXECUTE_WITHOUT_USER_PROMPT,
        CRUDBody: executeDto,
        routeParams: { promptId: process.env.GETCONFLUENCEPAGES },
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
      this.logger.log('Response from agent received')
      const parsedMessage = response.messageContent.content;
      const plexMessage = parsedMessage.Response;
      this.logger.log('Sending message to Slack', plexMessage); // For debugging purpose, can be removed later
      // Post the bot's response to the thread
      await this.postMessageToChannel(
        channelId,
        { text: plexMessage },
        token,
        threadId1, // Post the message in the thread
      );

      const { title, description } = parsedMessage;
      const { Page_Array } = parsedMessage; // Assuming the array of ticket IDs and descriptions is in Ticket_Array

      if (Page_Array && Page_Array.length > 0) {
        // If the array is not empty
        const allPageSummaries = [];
        for (const page of Page_Array) {
          const pageId = page.id; // Assuming each object in the array has an 'id' field
          const pageTitle = page.title; // Assuming each object in the array has a 'description' field

          // Call getSummaryJira function for each ticket ID
          const pageSummary = await this.getSummaryConfluence(
            pageId,
            jiraEmail, // Replace with your Jira email
            jiraToken, // Replace with your Jira token
            jiraBaseUrl, // Replace with your Jira base URL
            context,
          );

          // Add the ticket summary to the array
          allPageSummaries.push({
            pageId,
            pageTitle,
            summary: pageSummary,
          });
        }

        // Collate all ticket summaries into a single JSON object
        const allPageSummary = {
          summaries: allPageSummaries,
        };

        // // New LLM call to generate a concise summary
        const { conciseSummary, relevantPages } = await this.generateConciseSummary(
            allPageSummaries,
          title,
          description,
          context
        );

        // Modify conciseSummary and store in a new variable
        const modifiedSummary = conciseSummary.replace(/\*\*(.*?)\*\*/g, '*$1*'); // Convert bold from **text** to *text*


        // Determine the message about ticket links
        const pageLinksMessage = relevantPages.length > 0 
          ? 'Below are relevant page links for your purview' 
          : 'I could not find any relevant pages';

        
          // Combine the concise summary with the ticket links message
        const slackMessage = `${modifiedSummary}\n\n${pageLinksMessage}`;

        await this.postMessageToChannel(
          channelId,
          { text: conciseSummary },
          token,
          threadId1, // Post the message in the thread
        );

        // Generate Block Kit structure for ticket details
        const ticketBlocks = relevantPages.map(page => [
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*${page.pageId}:* ${page.pageLink}` },
            ]
          },
        //   {
        //     type: "section",
        //     fields: [
        //       { type: "mrkdwn", text: `*Status:* ${ticket.Status}` },
        //       // { type: "mrkdwn", text: `*Priority:* ${ticket.Priority}` },
        //       // { type: "mrkdwn", text: `*Type:* ${ticket.Type}` },
        //       { type: "mrkdwn", text: `*Assignee:* ${ticket.Assignee || "Unassigned"}` },
        //     ]
        //   },
          { type: "divider" }
        ]).flat();

        // Post the ticket details
        await this.postMessageToChannel(
          channelId,
          { blocks: ticketBlocks },
          token,
          threadId1
        );

        // Call createJiraTicket function with the collated summaries
        const ticketId = await this.createJiraTicket(
          title, // Replace with your overall ticket title
          description, // Replace with your overall ticket description
        );
        this.logger.log(`ticket created in Jira with ticketId:  ${ticketId}`);
        if (ticketId) {
          await this.chatService.createTicket(
            ticketId,
            title,
            teamId,
            threadId1,
            context,
            channelId,
          );
          this.logger.log('ticket created in database');
          await this.sendCsvAttachment(ticketId, allPageSummaries);
        }

        this.logger.log(
          'All ticket summaries collated and Jira ticket created',
        );
      }

      return { ...response.messageContent };
    } catch (error) {
      this.logger.error(`error ${error}`);
      throw Error(error);
    }
  }

  async getTeamData(userId: string, teamId: string) {
    try {
      const userRole = 'consultant';
      const messageKey = userId;
      const instanceId = 'consultant';

      const destinationService = 'database-service';
      const sourceFunction = 'getTeamData';
      const sourceType = 'service';
      const messageInput1 = {
        messageContent: {
          functionInput: {
            CRUDName: 'GET',
            CRUDInput: {
              tableEntity: 'OB1-slackWorkspaces',
              teamId: teamId,
            },
          },
          functionName: 'CRUDslackfunction',
        },
      };
      const messageInputAdd = {
        messageType: 'REQUEST',
        ...messageInput1,
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
      return response.messageContent;
    } catch (error) {
      this.logger.error('Error getting team data:', error.message);
    }
  }

  private async postMessageToChannel(
    channel: string,
    message: { text?: string; blocks?: any[] },
    token: string,
    thread_ts?: string,
  ) {
    try {
        this.logger.log(`Sending message to Slack inside function, ${message.text}`)
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
      this.logger.log('Sent message to Slack inside function')  // For debugging purpose, can be removed later

      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to post message to channel ${channel}:`,
        error.response?.data,
      );
      throw error;
    }
  }

  async getSummaryConfluence(
    pageId: string,
    jiraEmail: string,
    jiraToken: string,
    jiraBaseUrl: string,
    context: KafkaContext,
  ) {
    const headers: OB1MessageHeader = context.getMessage()
      .headers as unknown as OB1MessageHeader;
    const messageKey = context.getMessage().key.toString();
    const instanceName = context.getMessage().headers.instanceName.toString();

    const toolENVInputVariables = {
      jiraEmail: jiraEmail,
      jiraToken: jiraToken,
      jiraUrl: jiraBaseUrl,
      // fileUrl: fileUrls ? fileUrls: [],
    };

    const executeDto = {
      userPromptVariables: {
        pageId: pageId,
      },
      toolENVInputVariables,
    };

    const CRUDFunctionInput = {
      CRUDOperationName: CRUDOperationName.POST,
      CRUDRoute: CRUDPromptRoute.EXECUTE_WITHOUT_USER_PROMPT,
      CRUDBody: executeDto,
      routeParams: { promptId: process.env.GETSUMMARYCONFLUENCE },
    }; //CRUDFunctionInput

    const request: CRUDRequest = {
      messageKey, //messageKey
      userOrgId: instanceName || 'default', //instanceName
      sourceFunction: 'executePromptWithoutUserPrompt', //sourceFunction
      CRUDFunctionNameInput: 'promptCRUD-V1', //CRUDFunctionNameInput
      CRUDFunctionInput, //CRUDFunctionInput
      personRole: headers.userRole.toString() || 'user', // userRole
      personId: headers.userEmail.toString(), // userEmail
    };

    const response = await this.kafkaService.sendAgentCRUDRequest(request);
    if (
      response.messageContent.content &&
      response.messageContent.content.Summary
    ) {
      return response.messageContent.content.Summary;
    }
    return 'No Summary Found';
  }

  async generateConciseSummary(
    allPageSummaries: {
      pageId: string;
      pageTitle: string;
      summary: string;
    }[],
    title: string,
    description: string,
    context: KafkaContext,
  ) {
    const headers: OB1MessageHeader = context.getMessage()
      .headers as unknown as OB1MessageHeader;
    const messageKey = context.getMessage().key.toString();
    const instanceName = context.getMessage().headers.instanceName.toString();

    // const toolENVInputVariables = {
    //   summariesJson: allTicketSummary,
    //   title,
    //   summary,
    // };

    const executeDto = {
      userPromptVariables: {
        summariesJson: JSON.stringify(allPageSummaries),
        title,
        description,
      },
      // toolENVInputVariables,
    };

    const CRUDFunctionInput = {
      CRUDOperationName: CRUDOperationName.POST,
      CRUDRoute: CRUDPromptRoute.EXECUTE_WITHOUT_USER_PROMPT,
      CRUDBody: executeDto,
      routeParams: { promptId: process.env.CONCISESUMMARYCONFLUENCE },
    };

    const request: CRUDRequest = {
      messageKey,
      userOrgId: instanceName || 'default',
      sourceFunction: 'executePromptWithoutUserPrompt',
      CRUDFunctionNameInput: 'promptCRUD-V1',
      CRUDFunctionInput,
      personRole: headers.userRole.toString() || 'user',
      personId: headers.userEmail.toString(),
    };

    const response = await this.kafkaService.sendAgentCRUDRequest(request);
    // if (response.messageContent.content && response.messageContent.content.ConciseSummary) {
    //   return response.messageContent.content.ConciseSummary;
    // }
    if (response.messageContent.content) {
      const { ConciseSummary, RelevantPages } =
        response.messageContent.content;
      return {
        conciseSummary: ConciseSummary || 'No final Concise Summary Found',
        relevantPages: RelevantPages || [],
      };
    }
    return { conciseSummary: 'No Concise Summary Found', relevantPages: [] };
  }

  async createJiraTicket(summary: string, ticketDescription: string) {
    const jiraBaseUrl = this.JIRA_BASE_URL; // Replace with your Jira domain
    const ticketDetails = {
      fields: {
        project: {
          key: process.env.jiraProjectKey, // Project key where the issue will be created
        },
        summary: summary, // Short title
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: ticketDescription,
                },
              ],
            },
          ],
        }, // Detailed description
        issuetype: {
          name: 'Task', // Issue type (e.g., Task, Bug, Story)
        },
      },
    };

    try {
      const response = await axios.post(
        `${jiraBaseUrl}/rest/api/3/issue`,
        ticketDetails,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(
              `${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN}`,
            ).toString('base64')}`,
            Accept: 'application/json',
          },
        },
      );
      this.logger.log('Ticket created successfully:', response.data.key);
      return response.data.key;
    } catch (error) {
      this.logger.error(
        'Error creating Jira ticket:',
        error.response?.data || error.message,
      );
    }
  }

  async sendCsvAttachment(
    ticketId: string,
    csvData: Array<{ pageId: string; pageTitle: string; summary: string }>,
  ) {
    const jiraBaseUrl = this.JIRA_BASE_URL;
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `tempfile-${Date.now()}.csv`);

    try {
      // Create the CSV content with proper escaping, including handling of newlines
      const csvContent = csvData
        .map((row) => {
          const escapedTicketId = `"${row.pageId.replace(/"/g, '""')}"`;
          const escapedSummary = `"${row.summary.replace(/"/g, '""').replace(/\n/g, ' ')}"`;
          return `${escapedTicketId},${escapedSummary}`;
        })
        .join('\n');

      // Write to the CSV file
      fs.writeFileSync(
        tempFilePath,
        `"ticketId","contentSummary"\n${csvContent}`,
      );
      this.logger.log('Temporary CSV file created at:', tempFilePath);

      // Create the form data for the attachment
      const formData = new FormData();
      formData.append('file', fs.createReadStream(tempFilePath));

      // Send the CSV as an attachment to the Jira ticket
      const response = await axios.post(
        `${jiraBaseUrl}/rest/api/3/issue/${ticketId}/attachments`,
        formData,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(
              `${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN}`,
            ).toString('base64')}`,
            'X-Atlassian-Token': 'no-check',
            ...formData.getHeaders(),
          },
        },
      );

      this.logger.log('Attachment added successfully:', response.data);
    } catch (error) {
      this.logger.error(
        'Error adding attachment to Jira ticket:',
        error.response?.data || error.message,
      );
    } finally {
      // Clean up the temporary file
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
          this.logger.log('Temporary file removed.');
        }
      } catch (cleanupError) {
        this.logger.error(
          'Error removing temporary file:',
          cleanupError.message,
        );
      }
    }
  }
}
