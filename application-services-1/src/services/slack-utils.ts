export function createProjectBlocks(projects: any[]): any[] {
    const blocks = [
        {
			type: "rich_text",
			elements: [
				{
					type: "rich_text_list",
					style: "bullet",
                    elements:[]
                }
            ]
        }
    ]
  
    projects.forEach((project) => {

        
        blocks[0].elements[0].elements.push({
            type: "rich_text_section",
            elements: [
                {
                    type: "text",
                    text: `${project.projectName}`
                },
                
            ]
        });
      });
  
    return blocks;
  }
  