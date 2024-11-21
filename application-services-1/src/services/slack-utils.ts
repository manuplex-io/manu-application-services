export function createProjectBlocks(projects: any[]): any[] {
    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Here is the list of projects:*',
        },
      },
      { type: 'divider' },
    ];
  
    projects.forEach((project) => {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${project.projectName}*\n${project.projectDescription || 'No description available.'}\n*Status:* ${project.projectStatus}\n*Type:* ${project.projectType}\n*Created At:* ${new Date(
            project.createdAt,
          ).toLocaleString()}`,
        },
      });
      blocks.push({ type: 'divider' });
    });
  
    return blocks;
  }
  