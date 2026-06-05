import { ActionItem } from "./database.js";
import { sendReminder } from "./telegram.js";

export async function processReminders() {

    const tomorrow = new Date();

    tomorrow.setDate(
        tomorrow.getDate() + 1
    );

    const items = await ActionItem.find({
        status: {
            $ne: "Completed"
        },

        due_date: {
            $lte: tomorrow
        }
    });

    for (const item of items) {

        await sendReminder(item);
    }
}
