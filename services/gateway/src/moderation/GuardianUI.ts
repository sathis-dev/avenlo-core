// ====================================
// AVENLO CORE - GUARDIAN UI
// Premium Moderation Visuals
// ====================================

import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Message,
    User,
    Colors,
} from 'discord.js';
import { AvenloColors, AvenloEmojis, IInfraction, InfractionSeverity, ModActionTaken, InfractionType } from '@avenlo/shared';

export class GuardianUI {

    /**
     * Build the main moderation log embed
     */
    static buildLogEmbed(
        infraction: IInfraction,
        user: User,
        latency: number
    ): EmbedBuilder {
        const isCritical = infraction.severity === 'CRITICAL' || infraction.severity === 'HIGH';

        // Status Icon & Color
        let color: any = AvenloColors.BLUE;
        let icon = '🛡️';
        let title = 'Automated Action';

        switch (infraction.severity) {
            case 'CRITICAL':
                color = AvenloColors.RED;
                icon = '🚨';
                title = 'CRITICAL PATTERN DETECTED';
                break;
            case 'HIGH':
                color = 0xFF6B6B; // Soft Red
                icon = '⚠️';
                title = 'High Severity Violation';
                break;
            case 'MEDIUM':
                color = AvenloColors.YELLOW;
                icon = '⚡';
                title = 'Moderation Violation';
                break;
            case 'LOW':
                color = AvenloColors.CYAN;
                icon = 'ℹ️';
                title = 'Policy Notice';
                break;
        }

        const embed = new EmbedBuilder()
            .setColor(color)
            .setAuthor({
                name: `Guardian AI | ${title}`,
                iconURL: 'https://cdn.discordapp.com/emojis/1122334455.png', // Placeholder for bot icon
            })
            .setThumbnail(user.displayAvatarURL())
            .setDescription(
                `> **Message:** ${infraction.messageContent.slice(0, 300)}${infraction.messageContent.length > 300 ? '...' : ''}\n\n` +
                `**Allows you to take action immediately:**`
            )
            .addFields(
                {
                    name: '👤 User',
                    value: `**${user.tag}**\n\`${user.id}\``,
                    inline: true
                },
                {
                    name: '🔍 Detection',
                    value: `**${infraction.type}**\nConfidence: \`${infraction.aiReasoning.confidence}%\``,
                    inline: true
                },
                {
                    name: '⚡ Action',
                    value: `**${infraction.actionTaken}**\nLatency: \`${latency}ms\``,
                    inline: true
                }
            )
            .addFields({
                name: '🤖 AI Analysis',
                value: `\`\`\`${infraction.aiReasoning.reasoning}\`\`\``,
                inline: false
            });

        // CSI: Dispute Resolution Card - Factors Breakdown
        const mitigating = infraction.aiReasoning.mitigatingFactors;
        const aggravating = infraction.aiReasoning.aggravatingFactors;

        if ((mitigating && mitigating.length > 0) || (aggravating && aggravating.length > 0)) {
            embed.addFields(
                {
                    name: '📉 Mitigating Factors',
                    value: mitigating?.map(m => `• ${m}`).join('\n') || 'None',
                    inline: true
                },
                {
                    name: '📈 Aggravating Factors',
                    value: aggravating?.map(a => `• ${a}`).join('\n') || 'None',
                    inline: true
                }
            );
        }

        // CSI: Context Buffer
        if (infraction.messageContext && infraction.messageContext.length > 0) {
            const contextLines = infraction.messageContext
                .slice(-5) // Last 5 messages
                .map(m => `\`[${m.timestamp}]\` **${m.authorUsername}:** ${m.content.slice(0, 50)}`)
                .join('\n');

            embed.addFields({
                name: '📜 Context Buffer (Last 7 Messages)',
                value: contextLines || 'No recent context.',
                inline: false
            });
        }

        embed.setFooter({
            text: `Case ID: ${infraction.infractionId} • Guardian v2.1 CSI`,
            iconURL: 'https://i.imgur.com/some-icon.png'
        })
            .setTimestamp();

        // Add Image Analysis if present
        if (infraction.imageAnalysis) {
            embed.setImage(infraction.imageAnalysis.imageUrl);
            const flags = infraction.imageAnalysis.iconographyFlags.join(', ') || 'None';
            const text = infraction.imageAnalysis.extractedText
                ? infraction.imageAnalysis.extractedText.slice(0, 100) + '...'
                : 'None detected';

            embed.addFields({
                name: '👁️ Vision Analysis',
                value: `**NSFW:** ${Math.round(infraction.imageAnalysis.nsfwProbability * 100)}% | **Flags:** ${flags}\n**Text:** ${text}`,
                inline: false
            });
        }

        return embed;
    }

    /**
     * Build interactive action buttons
     */
    static buildActionRows(infractionId: string, currentAction: ModActionTaken): ActionRowBuilder<ButtonBuilder>[] {
        const row1 = new ActionRowBuilder<ButtonBuilder>();

        // Ban Button
        row1.addComponents(
            new ButtonBuilder()
                .setCustomId(`mod:ban:${infractionId}`)
                .setLabel('Ban User')
                .setEmoji('🔨')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(currentAction === 'BAN')
        );

        // Kick Button
        row1.addComponents(
            new ButtonBuilder()
                .setCustomId(`mod:kick:${infractionId}`)
                .setLabel('Kick')
                .setEmoji('👢')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentAction === 'KICK' || currentAction === 'BAN')
        );

        // Mute/Timeout Button
        row1.addComponents(
            new ButtonBuilder()
                .setCustomId(`mod:mute:${infractionId}`)
                .setLabel('Timeout (1h)')
                .setEmoji('🔇')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentAction.startsWith('TIMEOUT'))
        );

        const row2 = new ActionRowBuilder<ButtonBuilder>();

        // Forgive/Dismiss
        row2.addComponents(
            new ButtonBuilder()
                .setCustomId(`mod:dismiss:${infractionId}`)
                .setLabel('Dismiss/Forgive')
                .setEmoji('✅')
                .setStyle(ButtonStyle.Success)
        );

        // Delete Pattern (add to blocklist)
        row2.addComponents(
            new ButtonBuilder()
                .setCustomId(`mod:blocklist:${infractionId}`)
                .setLabel('Add to Blocklist')
                .setEmoji('🚫')
                .setStyle(ButtonStyle.Primary)
        );

        // CSI: Re-train / Feedback Loop
        row2.addComponents(
            new ButtonBuilder()
                .setCustomId(`mod:retrain:${infractionId}`)
                .setLabel('Re-train AI')
                .setEmoji('🧠')
                .setStyle(ButtonStyle.Secondary)
        );

        return [row1, row2];
    }

    /**
     * Build public notice embed (for the user DM or public channel)
     */
    static buildUserNoticeEmbed(
        action: ModActionTaken,
        reason: string,
        serverName: string
    ): EmbedBuilder {
        let color: any = AvenloColors.YELLOW;
        let title = '⚠️ Moderation Notice';

        if (action === 'BAN' || action === 'KICK') {
            color = AvenloColors.RED;
            title = `🛑 Action Taken: ${action}`;
        }

        return new EmbedBuilder()
            .setColor(color)
            .setTitle(title)
            .setDescription(
                `You have received a moderation action in **${serverName}**.\n\n` +
                `**Reason:**\n${reason}\n\n` +
                `*If you believe this is a mistake, please contact server staff.*`
            )
            .setTimestamp();
    }
}
