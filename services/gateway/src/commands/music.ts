// ====================================
// AVENLO CORE - MUSIC COMMAND
// Standard music playback commands (Custom Native Engine)
// ====================================

import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { MusicHandler, Track } from '../handlers/MusicHandler';
import play from 'play-dl';

export const data = new SlashCommandBuilder()
  .setName('music')
  .setDescription('Play and manage music in your voice channel')
  .addSubcommand(subcommand =>
    subcommand
      .setName('play')
      .setDescription('Play a song from YouTube, SoundCloud, or Spotify')
      .addStringOption(option =>
        option.setName('query')
          .setDescription('The song name or URL')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('stop')
      .setDescription('Stop playing and clear the queue')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('skip')
      .setDescription('Skip the current song')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('queue')
      .setDescription('View the current music queue')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('clear')
      .setDescription('Clear all upcoming songs in the queue')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('shuffle')
      .setDescription('Shuffle the upcoming songs in the queue')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Remove a specific song from the queue')
      .addIntegerOption(option => 
        option.setName('position')
          .setDescription('The queue position number of the song to remove')
          .setRequired(true)
          .setMinValue(1)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('volume')
      .setDescription('Adjust the playback volume')
      .addIntegerOption(option => 
        option.setName('level')
          .setDescription('Volume level (1-100)')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(100)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('loop')
      .setDescription('Change the loop mode')
      .addStringOption(option => 
        option.setName('mode')
          .setDescription('Loop mode')
          .setRequired(true)
          .addChoices(
            { name: 'Off', value: 'off' },
            { name: 'Track', value: 'track' },
            { name: 'Queue', value: 'queue' }
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('seek')
      .setDescription('Seek to a specific time in the current track')
      .addStringOption(option => 
        option.setName('time')
          .setDescription('Time to seek to (e.g. 1:30 or 90)')
          .setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const member = interaction.member as GuildMember;
    
    if (!member.voice.channel) {
      return interaction.reply({ content: '❌ You must be in a voice channel to use this command.', flags: ['Ephemeral'] });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'play') {
      const query = interaction.options.getString('query', true);
      
      await interaction.deferReply();

      // play-dl search
      let searchResults;
      try {
        if (query === 'testmp3') {
           const testTrack: Track = {
               title: 'SoundHelix Song 1 (Test MP3)',
               url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
               requestedBy: interaction.user.tag,
               author: 'SoundHelix'
           };
           await MusicHandler.playTrack(interaction.guildId!, member.voice.channel, testTrack, interaction.channel!);
           return interaction.editReply(`✅ Added test MP3 to the queue.`);
        }

        if (play.sp_validate(query) === 'track') {
           const sp_data = await play.spotify(query) as any;
           const artistName = sp_data.artists && sp_data.artists.length > 0 ? sp_data.artists[0].name : '';
           searchResults = await play.search(`${sp_data.name} ${artistName}`, { source: { soundcloud: 'tracks' }, limit: 1 });
        } else if (query.startsWith('http')) {
           searchResults = [await play.soundcloud(query)];
        } else {
           searchResults = await play.search(query, { source: { soundcloud: 'tracks' }, limit: 1 });
        }
      } catch (err) {
        return interaction.editReply(`❌ Could not find any results for that query.`);
      }

      if (!searchResults || searchResults.length === 0) {
        return interaction.editReply(`❌ No results found!`);
      }

      const info: any = searchResults[0];
      const track: Track = {
        title: info.name || info.title || 'Unknown Title',
        url: info.url,
        thumbnail: info.thumbnail || info.thumbnails?.[0]?.url,
        author: info.publisher?.name || info.channel?.name || 'SoundCloud',
        duration: info.durationRaw || info.durationInSec?.toString(),
        requestedBy: interaction.user.tag
      };

      await MusicHandler.playTrack(interaction.guildId!, member.voice.channel, track, interaction.channel!);
      
      await interaction.editReply(`⏳ **Loading...** Track added to the queue: **${track.title}**`);

    } else if (subcommand === 'stop') {
      const queue = MusicHandler.getQueue(interaction.guildId!);
      if (!queue.player) {
        return interaction.reply({ content: '❌ Nothing is currently playing.', flags: ['Ephemeral'] });
      }
      queue.tracks = [];
      queue.player.stop();
      await interaction.reply('⏹️ Stopped the music and cleared the queue.');

    } else if (subcommand === 'skip') {
      const queue = MusicHandler.getQueue(interaction.guildId!);
      if (!queue.player || !queue.currentTrack) {
        return interaction.reply({ content: '❌ Nothing is currently playing.', flags: ['Ephemeral'] });
      }
      queue.player.stop(); // triggers AudioPlayerStatus.Idle, which plays the next track
      await interaction.reply('⏭️ Skipped the current track.');

    } else if (subcommand === 'queue') {
      const queue = MusicHandler.getQueue(interaction.guildId!);
      if (queue.tracks.length === 0 && !queue.currentTrack) {
        return interaction.reply({ content: '❌ The queue is currently empty.', flags: ['Ephemeral'] });
      }

      let qMsg = `**🎶 Current Queue**\n\n`;
      if (queue.currentTrack) {
        qMsg += `**Now Playing:** [${queue.currentTrack.title}](${queue.currentTrack.url})\n\n`;
      }

      if (queue.tracks.length > 0) {
        qMsg += `**Up Next:**\n`;
        const tracks = queue.tracks.slice(0, 10);
        tracks.forEach((t, i) => {
          qMsg += `**${i + 1}.** [${t.title}](${t.url}) - Requested by ${t.requestedBy}\n`;
        });
        if (queue.tracks.length > 10) {
          qMsg += `\n*...and ${queue.tracks.length - 10} more*`;
        }
      } else {
        qMsg += `*No upcoming tracks.*`;
      }
      await interaction.reply({ content: qMsg, flags: ['Ephemeral'] });

    } else if (subcommand === 'clear') {
      const queue = MusicHandler.getQueue(interaction.guildId!);
      queue.tracks = [];
      await interaction.reply('🗑️ Cleared the queue.');

    } else if (subcommand === 'shuffle') {
      const queue = MusicHandler.getQueue(interaction.guildId!);
      if (queue.tracks.length === 0) return interaction.reply({ content: '❌ Queue is empty!', flags: ['Ephemeral'] });
      for (let i = queue.tracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue.tracks[i], queue.tracks[j]] = [queue.tracks[j], queue.tracks[i]];
      }
      await interaction.reply('🔀 Shuffled the queue.');

    } else if (subcommand === 'remove') {
      const pos = interaction.options.getInteger('position', true);
      const queue = MusicHandler.getQueue(interaction.guildId!);
      if (pos < 1 || pos > queue.tracks.length) {
        return interaction.reply({ content: '❌ Invalid position.', flags: ['Ephemeral'] });
      }
      const removed = queue.tracks.splice(pos - 1, 1)[0];
      await interaction.reply(`🗑️ Removed **${removed.title}** from the queue.`);

    } else if (subcommand === 'volume') {
      const level = interaction.options.getInteger('level', true);
      const queue = MusicHandler.getQueue(interaction.guildId!);
      queue.volume = level;
      if (queue.audioResource && queue.audioResource.volume) {
        queue.audioResource.volume.setVolume(level / 100);
      }
      await interaction.reply(`🔊 Set volume to **${level}%**`);

    } else if (subcommand === 'loop') {
      const mode = interaction.options.getString('mode', true) as 'off' | 'track' | 'queue';
      const queue = MusicHandler.getQueue(interaction.guildId!);
      queue.loopMode = mode;
      await interaction.reply(`🔁 Loop mode set to: **${mode.toUpperCase()}**`);

    } else if (subcommand === 'seek') {
      const timeStr = interaction.options.getString('time', true);
      let targetSeconds = 0;
      
      // parse time (e.g. 1m30s or 90 or 1:30)
      if (timeStr.includes(':')) {
        const parts = timeStr.split(':').reverse();
        if (parts[0]) targetSeconds += parseInt(parts[0]);
        if (parts[1]) targetSeconds += parseInt(parts[1]) * 60;
        if (parts[2]) targetSeconds += parseInt(parts[2]) * 3600;
      } else if (timeStr.includes('m') || timeStr.includes('s')) {
        const minMatch = timeStr.match(/(\d+)m/);
        const secMatch = timeStr.match(/(\d+)s/);
        if (minMatch) targetSeconds += parseInt(minMatch[1]) * 60;
        if (secMatch) targetSeconds += parseInt(secMatch[1]);
      } else if (!isNaN(parseInt(timeStr))) {
        targetSeconds = parseInt(timeStr);
      }

      const queue = MusicHandler.getQueue(interaction.guildId!);
      if (!queue.player || !queue.currentTrack) {
        return interaction.reply({ content: '❌ Nothing is currently playing.', flags: ['Ephemeral'] });
      }

      queue.seekOffset = targetSeconds;
      const track = queue.currentTrack;
      queue.currentTrack = null; // bypass loop handler
      queue.tracks.unshift(track); // put it back as next track
      queue.player.stop(); // trigger idle which calls playNext
      
      await interaction.reply(`⏩ Seeking to **${targetSeconds}s**...`);
    }
  } catch (error) {
    console.error('Music command error:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ An error occurred while executing the command.', flags: ['Ephemeral'] });
    } else {
      await interaction.editReply({ content: '❌ An error occurred while executing the command.' });
    }
  }
}

export const musicCommand: any = {
  data: data as any,
  execute: execute
};
