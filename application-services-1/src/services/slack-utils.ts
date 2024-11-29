import { HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';

/**
 * Posts a message to a Slack channel.
 * @param channel - The Slack channel ID.
 * @param message - The message object containing text and optional blocks.
 * @param token - The Slack API token.
 */
interface SlackWorkspaceResponse {
  ok: boolean;
  team?: {
    id: string;
    name: string;
    domain: string;
    email_domain?: string;
    icon: {
      image_34: string;
      image_44: string;
      image_68: string;
      image_88: string;
      image_102: string;
      image_132: string;
      image_230: string;
    };
  };
  error?: string;
}

const SLACK_BASE_URL = 'https://slack.com/api';

export async function postMessageToSlackChannel(
  channel: string,
  message: { text: string; blocks?: any[] },
  token: string,
  threadTs: string,
): Promise<void> {

  try {
    const response = await axios.post(
      `${SLACK_BASE_URL}/chat.postMessage`,
      {
        channel: channel,
        text: message.text, // Fallback text for notifications or unsupported clients
        blocks: message.blocks, // Richly formatted blocks
        thread_ts: threadTs,
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
    console.error(
      `Failed to post message to channel ${channel}:`,
      error.response?.data,
    );
    throw error;
  }
}

/**
 * Creates Slack message blocks for a list of projects.
 * @param projects - The list of projects.
 * @returns Slack message blocks.
 */
// Define interfaces for Slack Block Kit structures
interface TextElement {
    type: 'text';
    text: string;
  }
  
  interface RichTextSection {
    type: 'rich_text_section';
    elements: TextElement[];
  }
  
  interface RichTextList {
    type: 'rich_text_list';
    style: 'bullet' | 'ordered';
    elements: RichTextSection[];
  }
  
  interface RichTextBlock {
    type: 'rich_text';
    elements: (RichTextSection | RichTextList)[];
  }
  
  interface Project {
    projectName: string;
    [key: string]: any; // Allow for other project properties
  }
  
  export function createProjectMessageBlocks(projects: Project[]): RichTextBlock[] {
    const blocks: RichTextBlock[] = [
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              {
                type: 'text',
                text: 'Here is the list of all projects\n'
              }
            ]
          },
          {
            type: 'rich_text_list',
            style: 'bullet',
            elements: []
          }
        ]
      }
    ];
  
    projects.forEach((project) => {
      (blocks[0].elements[1] as RichTextList).elements.push({
        type: 'rich_text_section',
        elements: [
          {
            type: 'text',
            text: `${project.projectName}`
          }
        ]
      });
    });
  
    return blocks;
  }

export async function findWorkspace(
  teamId: string,
  token: string,
): Promise<SlackWorkspaceResponse> {
  try {
    const response = await axios.get<SlackWorkspaceResponse>(
      `${SLACK_BASE_URL}/team.info`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        params: {
          team: teamId,
        },
      },
    );
    return response.data;
  } catch (error) {
    console.error(
      `Failed to find workspace with team ID ${teamId}:`,
      error.response?.data,
    );
    throw error;
  }
}

export function extractUserIds(text: string): string[] {
    const matches = text.matchAll(/<@([A-Z0-9]+)>/g);
    return Array.from(matches, match => match[1]);
}

/**
* Retrieves the last 5 messages from a Slack channel
* @param channelId - The ID of the Slack channel
* @param slackToken - The Slack bot token
* @returns A promise resolving to the last 5 messages
*/
export async function getChannelMessageHistory(channelId: string, slackToken: string): Promise<any[]> {
 // Validate inputs
 if (!channelId || typeof channelId !== 'string') {
   throw new HttpException('Invalid channelId. It must be a non-empty string.', HttpStatus.BAD_REQUEST);
 }
 if (!slackToken || typeof slackToken !== 'string') {
   throw new HttpException('Invalid slackToken. It must be a non-empty string.', HttpStatus.BAD_REQUEST);
 }

 try {
   // Call the Slack API
   const response = await axios.get(`${SLACK_BASE_URL}/conversations.history`, {
     headers: {
       Authorization: `Bearer ${slackToken}`,
       'Content-Type': 'application/json',
     },
     params: {
       channel: channelId,
       limit: 5, // Retrieve only the last 5 messages
     },
   });

   // Validate response
   if (!response.data.ok) {
     throw new HttpException(`Slack API error: ${response.data.error}`, HttpStatus.BAD_REQUEST);
   }

   // Return messages
   return response.data.messages.map((message: any) => ({
     text: message.text,
     ts: message.ts,
     user: message.user || 'unknown',
   }));
 } catch (error) {
   console.error('Error fetching Slack messages:', error.message);
   throw new HttpException(
     'Failed to retrieve channel messages. Please check the inputs and permissions.',
     HttpStatus.INTERNAL_SERVER_ERROR,
   );
 }
}
