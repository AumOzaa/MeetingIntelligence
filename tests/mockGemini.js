export const mockGeminiResponse = {
    text: JSON.stringify({
        summary: [
            {
                text: "Launch postponed",
                citations: [
                    {
                        timestamp: "00:10"
                    }
                ]
            }
        ],
        actionItems: [
            {
                task: "Prepare release notes",
                assignee: "Alice",
                status: "PENDING",
                citations: [
                    {
                        timestamp: "00:20"
                    }
                ]
            }
        ],
        decisions: [
            {
                decision: "Launch next Friday",
                citations: [
                    {
                        timestamp: "00:35"
                    }
                ]
            }
        ],
        followUpSuggestions: [
            {
                suggestion: "Review patch gaps",
                citations: [
                    {
                        timestamp: "00:35"
                    }
                ]
            }
        ]
    })
};
