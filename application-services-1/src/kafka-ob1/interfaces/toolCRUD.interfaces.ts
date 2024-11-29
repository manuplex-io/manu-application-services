

export const CRUDToolRoute = {
    LIST_TOOLS: 'tools',
    GET_TOOL: 'tools/:toolId',

} as const;

export type CRUDToolRouteType = typeof CRUDToolRoute[keyof typeof CRUDToolRoute];