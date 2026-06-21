// ====================================
// AVENLO CORE - MUSIC HANDLER (CUSTOM)
// Custom lightweight implementation using @discordjs/voice + play-dl
// ====================================

import { Client, Guild, VoiceBasedChannel, TextBasedChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Message } from 'discord.js';
import { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus, 
  VoiceConnectionStatus,
  VoiceConnection,
  AudioPlayer
} from '@discordjs/voice';
import play from 'play-dl';
import { createLogger, AvenloColors, AvenloBranding } from '@avenlo/shared';

const logger = createLogger('music-handler');

export interface Track {
  title: string;
  url: string;
  thumbnail?: string;
  author?: string;
  duration?: string;
  requestedBy: string;
}

export class GuildQueue {
  public tracks: Track[] = [];
  public connection: VoiceConnection | null = null;
  public player: AudioPlayer | null = null;
  public currentTrack: Track | null = null;
  public textChannel: TextBasedChannel | null = null;
  public playingMessage: Message | null = null;
  public loopMode: 'off' | 'track' | 'queue' = 'off';
  public volume: number = 100;
  public audioResource: any = null;
  public playbackStartTime: number = 0;
  public seekOffset: number = 0;
  public progressInterval: NodeJS.Timeout | null = null;
  public isProcessing: boolean = false;

  constructor(public guildId: string) {}
}

export class MusicHandler {
  private static client: Client;
  private static queues: Map<string, GuildQueue> = new Map();

  public static async init(client: Client) {
    this.client = client;
    
    try {
      const clientID = await play.getFreeClientID();
      play.setToken({
        soundcloud: {
          client_id: clientID
        }
      });
      logger.info('play-dl SoundCloud initialized.');
    } catch (err) {
      logger.error('Failed to initialize play-dl SoundCloud:', err);
    }
    
    logger.info('Custom Music Engine Initialized (@discordjs/voice + play-dl)');
  }

  public static getQueue(guildId: string): GuildQueue {
    if (!this.queues.has(guildId)) {
      this.queues.set(guildId, new GuildQueue(guildId));
    }
    return this.queues.get(guildId)!;
  }

  public static async playTrack(guildId: string, channel: VoiceBasedChannel, track: Track, textChannel: TextBasedChannel) {
    const queue = this.getQueue(guildId);
    queue.textChannel = textChannel;
    queue.tracks.push(track);

    if (!queue.connection || queue.connection.state.status === VoiceConnectionStatus.Disconnected) {
      queue.connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guildId,
        adapterCreator: channel.guild.voiceAdapterCreator as any,
      });

      queue.connection.on(VoiceConnectionStatus.Disconnected, () => {
        logger.info(`[Music] Voice connection disconnected in ${guildId}`);
        this.destroyQueue(guildId);
      });
    }

    if (!queue.player) {
      queue.player = createAudioPlayer();
      queue.connection.subscribe(queue.player);

      queue.player.on(AudioPlayerStatus.Idle, () => {
        if (queue.currentTrack) {
          if (queue.loopMode === 'track') {
            queue.tracks.unshift(queue.currentTrack);
          } else if (queue.loopMode === 'queue') {
            queue.tracks.push(queue.currentTrack);
          }
        }
        if (queue.progressInterval) {
          clearInterval(queue.progressInterval);
          queue.progressInterval = null;
        }
        queue.currentTrack = null;
        this.playNext(guildId);
      });

      queue.player.on('error', error => {
        logger.error(`[Music] AudioPlayer error: ${error.message}`);
        this.playNext(guildId);
      });
    }

    if (queue.player.state.status === AudioPlayerStatus.Idle && !queue.isProcessing) {
      this.playNext(guildId);
    }
  }

  private static async playNext(guildId: string) {
    const queue = this.getQueue(guildId);
    
    if (queue.tracks.length === 0) {
      if (queue.textChannel && 'send' in queue.textChannel) {
        (queue.textChannel as any).send({ embeds: [
          new EmbedBuilder()
            .setColor(AvenloColors.GREEN)
            .setDescription(`✅ Queue finished! I am leaving the voice channel.`)
        ]});
      }
      this.destroyQueue(guildId);
      return;
    }

    if (queue.isProcessing) return;
    queue.isProcessing = true;

    const track = queue.tracks.shift()!;
    queue.currentTrack = track;

    try {
      logger.info(`[Music] Extracting audio for ${track.title} via play-dl (seek: ${queue.seekOffset}s)...`);
      const stream = await play.stream(track.url, { seek: queue.seekOffset });
      
      const resource = createAudioResource(stream.stream, {
        inputType: stream.type,
        inlineVolume: true,
      });
      
      resource.volume?.setVolume(queue.volume / 100);
      queue.audioResource = resource;
      queue.playbackStartTime = Date.now();

      queue.player!.play(resource);

      // Send Now Playing embed
      if (queue.textChannel) {
        const generateProgressBar = () => {
          if (!track.duration) return '';
          
          // parse mm:ss to total seconds
          let totalSeconds = 0;
          const parts = track.duration.split(':').reverse();
          if (parts[0]) totalSeconds += parseInt(parts[0]);
          if (parts[1]) totalSeconds += parseInt(parts[1]) * 60;
          if (parts[2]) totalSeconds += parseInt(parts[2]) * 3600;

          if (totalSeconds === 0) return '🔴 Live';

          let elapsed = queue.seekOffset;
          if (queue.audioResource && queue.player?.state.status === AudioPlayerStatus.Playing) {
             elapsed += Math.floor((Date.now() - queue.playbackStartTime) / 1000);
          }
          if (elapsed > totalSeconds) elapsed = totalSeconds;

          const percent = Math.floor((elapsed / totalSeconds) * 20);
          const bar = '▬'.repeat(percent) + '🔘' + '▬'.repeat(20 - percent);
          
          const formatTime = (secs: number) => {
            const m = Math.floor(secs / 60);
            const s = secs % 60;
            return `${m}:${s.toString().padStart(2, '0')}`;
          };

          return `\n\n\`${bar}\`\n\`[ ${formatTime(elapsed)} / ${formatTime(totalSeconds)} ]\``;
        };

        const embed = new EmbedBuilder()
          .setColor(AvenloColors.BLUE)
          .setTitle(`🎶 Now Playing`)
          .setDescription(`**[${track.title}](${track.url})**${generateProgressBar()}`)
          .addFields(
            { name: 'Author', value: track.author || 'Unknown', inline: true },
            { name: 'Volume', value: `${queue.volume}%`, inline: true },
            { name: 'Loop', value: queue.loopMode.toUpperCase(), inline: true }
          )
          .setFooter({ text: `Requested by ${track.requestedBy} • ${AvenloBranding.footer}` });

        if (track.thumbnail) embed.setThumbnail(track.thumbnail);

        const row1 = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('music_pause')
              .setLabel('Pause / Resume')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('⏯️'),
            new ButtonBuilder()
              .setCustomId('music_skip')
              .setLabel('Skip')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('⏭️'),
            new ButtonBuilder()
              .setCustomId('music_stop')
              .setLabel('Stop')
              .setStyle(ButtonStyle.Danger)
              .setEmoji('⏹️')
          );
          
        const row2 = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('music_shuffle')
              .setLabel('Shuffle')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('🔀'),
            new ButtonBuilder()
              .setCustomId('music_loop')
              .setLabel('Loop')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('🔁')
          );

        if (queue.playingMessage) {
          await queue.playingMessage.delete().catch(() => {});
        }
        
        queue.playingMessage = await (queue.textChannel as any).send({ embeds: [embed], components: [row1, row2] });

        // Live update progress bar every 10 seconds
        queue.progressInterval = setInterval(() => {
          if (!queue.playingMessage || queue.player?.state.status !== AudioPlayerStatus.Playing) return;
          const updatedEmbed = new EmbedBuilder(embed.toJSON())
            .setDescription(`**[${track.title}](${track.url})**${generateProgressBar()}`);
          queue.playingMessage.edit({ embeds: [updatedEmbed] }).catch(() => {
            if (queue.progressInterval) clearInterval(queue.progressInterval);
          });
        }, 10000);
      }
      
      queue.isProcessing = false;

    } catch (err) {
      queue.isProcessing = false;
      logger.error(`[Music] Failed to play track: ${err}`);
      if (queue.textChannel && 'send' in queue.textChannel) {
        (queue.textChannel as any).send(`❌ Failed to play **${track.title}**: \`${(err as Error).message}\``);
      }
      this.playNext(guildId); // skip to next
    }
  }

  public static destroyQueue(guildId: string) {
    const queue = this.queues.get(guildId);
    if (queue) {
      if (queue.connection) queue.connection.destroy();
      this.queues.delete(guildId);
    }
  }

  public static handleButton(interaction: any) {
    const queue = this.getQueue(interaction.guildId);
    if (!queue || !queue.player) {
      return interaction.reply({ content: 'No music is currently playing!', flags: ['Ephemeral'] });
    }

    if (interaction.customId === 'music_pause') {
      if (queue.player.state.status === AudioPlayerStatus.Playing) {
        queue.player.pause();
        interaction.reply({ content: '⏸️ Paused the music.', flags: ['Ephemeral'] });
      } else {
        queue.player.unpause();
        interaction.reply({ content: '▶️ Resumed the music.', flags: ['Ephemeral'] });
      }
    } else if (interaction.customId === 'music_skip') {
      queue.player.stop();
      interaction.reply({ content: '⏭️ Skipped the current track.', flags: ['Ephemeral'] });
    } else if (interaction.customId === 'music_stop') {
      queue.tracks = [];
      queue.player.stop();
      interaction.reply({ content: '⏹️ Stopped the music and cleared the queue.', flags: ['Ephemeral'] });
    } else if (interaction.customId === 'music_shuffle') {
      if (queue.tracks.length === 0) {
        return interaction.reply({ content: '❌ The queue is empty!', flags: ['Ephemeral'] });
      }
      for (let i = queue.tracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue.tracks[i], queue.tracks[j]] = [queue.tracks[j], queue.tracks[i]];
      }
      interaction.reply({ content: '🔀 Shuffled the queue.', flags: ['Ephemeral'] });
    } else if (interaction.customId === 'music_loop') {
      if (queue.loopMode === 'off') queue.loopMode = 'track';
      else if (queue.loopMode === 'track') queue.loopMode = 'queue';
      else queue.loopMode = 'off';
      interaction.reply({ content: `🔁 Loop mode set to: **${queue.loopMode.toUpperCase()}**`, flags: ['Ephemeral'] });
    }
  }
}
