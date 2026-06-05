// telegram.js

import TelegramBot from "node-telegram-bot-api";

const bot = new TelegramBot(
    process.env.TELEGRAM_BOT_TOKEN
);

export async function sendReminder(
    actionItem
) {
    const message = `
🔔 Reminder

Task: ${actionItem.task}

Assigned To: ${actionItem.assignee}

Due Date: ${actionItem.due_date}
`;

    await bot.sendMessage(
        process.env.TELEGRAM_CHAT_ID,
        message
    );
}
