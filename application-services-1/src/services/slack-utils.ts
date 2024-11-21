export function createProjectBlocks(projects: any[]): any[] {
    const blocks = [
    ];
  
    projects.forEach((project) => {
        blocks.push({
          type: 'rich_text',
          style: "bullet",
          elements: [
            {
              type: 'rich_text_section',
              elements: [
                {
                  type: 'text',
                  text: `${project.projectName}`
                }
              ]
            }
          ]
        });
        blocks.push({ type: 'divider' });
      });
  
    return blocks;
  }
  