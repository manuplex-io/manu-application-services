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

export async function postMessageToSlackChannel(
  channel: string,
  message: { text: string; blocks?: any[] },
  token: string,
  threadTs: string,
): Promise<void> {
  const SLACK_BASE_URL = 'https://slack.com/api';

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
export function createProjectMessageBlocks(projects: any[]): any[] {
  const blocks = [
    {
      type: 'rich_text',
      elements: [
        {
          type: 'rich_text_list',
          style: 'bullet',
          elements: [],
        },
      ],
    },
  ];

  projects.forEach((project) => {
    blocks[0].elements[0].elements.push({
      type: 'rich_text_section',
      elements: [
        {
          type: 'text',
          text: `${project.projectName}`,
        },
      ],
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
      `${this.SLACK_BASE_URL}/team.info`,
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
    this.logger.error(
      `Failed to find workspace with team ID ${teamId}:`,
      error.response?.data,
    );
    throw error;
  }
}
