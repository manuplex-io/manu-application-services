import axios from 'axios';





/**
 * Extracts the filename from a Jira comment.
 * 
 * @param comment - The Jira comment string
 * @returns The extracted filename if found, otherwise null
 */
function extractFilenameFromComment(comment: string): string | null {
  const filenameRegex = /(?:\b\w+\/\w+\b\(|\[)([^()\[\]]+\.(?:pdf|docx|xlsx|csv|jpg|jpeg|png|gif|txt|zip|rar|tar|gz|7z|pptx))\b/;
  const match = comment.match(filenameRegex);
  
  if (!match || match.length < 2) {
    console.error('No filename found in the comment.');
    return null;
  }

  return match[1];
}

/**
 * Gets the content URL of an attachment from a Jira issue response.
 * 
 * @param issueData - The Jira issue data (response from Jira API)
 * @param filename - The filename to search for in the attachments
 * @returns The content URL of the attachment if found, otherwise null
 */
function getAttachmentContentUrl(issueData: any, filename: string): string | null {
  if (!issueData || !issueData.fields || !issueData.fields.attachment) {
    console.error('Invalid issue data format.');
    return null;
  }

  const attachment = issueData.fields.attachment.find(att => att.filename === filename);
  if (!attachment) {
    console.error(`Attachment with filename "${filename}" not found in the issue.`);
    return null;
  }

  return attachment.content;
}

/**
 * Fetches the issue data from the Jira API and gets the attachment URL using the filename from the comment.
 * 
 * @param issueId - The Jira issue ID (e.g., 'PROJECT-123')
 * @param comment - The Jira comment string containing the filename
 * @returns A Promise that resolves to the attachment content URL or null if not found
 */
export async function getAttachmentUrlFromComment(ticketId: string, comment: string): Promise<string | null> {
  try {
    // Call the Jira API to fetch the issue data
    const response = await axios.get(`https://your-jira-instance.atlassian.net/rest/api/2/issue/${ticketId}`, {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN}`,
          ).toString('base64')}`,
          Accept: 'application/json',
        },
      });

    const issueData = response.data;

    const filename = extractFilenameFromComment(comment);
    if (!filename) {
      console.error('No filename extracted from the comment.');
      return null;
    }

    const contentUrl = getAttachmentContentUrl(issueData, filename);
    if (!contentUrl) {
      console.error(`Attachment URL for file "${filename}" not found.`);
    }

    return contentUrl;
  } catch (error) {
    console.error(`Failed to fetch Jira issue data for ticket ID "${ticketId}".`, error);
    return null;
  }
}
