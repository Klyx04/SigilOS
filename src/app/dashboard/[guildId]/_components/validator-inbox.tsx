import { getValidatorStats } from "@/server/actions/validator-actions";
import { ValidatorInboxClient } from "./validator-inbox-client";

interface ValidatorInboxProps {
    guildId: string;
}

export async function ValidatorInbox({ guildId }: ValidatorInboxProps) {
    const response = await getValidatorStats(guildId);
    
    if (!response.success || !response.data || response.data.hidden) {
        return null;
    }

    return <ValidatorInboxClient guildId={guildId} initialData={response.data} />;
}
