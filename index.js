// Discord Meetup RSVP Bot
// This bot connects to the Meetup.com API and posts RSVP updates to Discord
// Enhanced to watch multiple Meetup groups and track upcoming events

require('dotenv').config();
const { Client, GatewayIntentBits, PermissionFlagsBits, Events, REST, Routes } = require('discord.js');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Environment variables (store these in a .env file)
// DISCORD_TOKEN=your_discord_bot_token
// DISCORD_CLIENT_ID=your_discord_client_id
// GUILD_ID=your_discord_server_id
// RSVP_CHANNEL_ID=your_rsvp_channel_id
// MEETUP_API_KEY=your_meetup_api_key
// DATA_DIR=./data (or /app/data in Docker)
// POLL_INTERVAL=60000 (default: check every minute)

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

// Global variables and constants
const DATA_DIR = process.env.DATA_DIR || './data';
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const DEFAULT_CONFIG = {
  watchedGroups: [],
  trackedEvents: {},
  channelMessages: {}
};

// Storage for bot state
let botConfig = DEFAULT_CONFIG;
let isFirstRun = true;

// Initialize the bot
client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  // Ensure data directory exists
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    console.log(`Data directory available at ${DATA_DIR}`);
  } catch (error) {
    console.error('Error creating data directory:', error);
  }
  
  // Load saved configuration
  await loadConfig();
  
  // Register slash commands
  await registerCommands();
  
  // Start polling the Meetup API
  startPolling();
});

// Load configuration from disk
async function loadConfig() {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf8');
    botConfig = JSON.parse(data);
    console.log('Configuration loaded');
  } catch (error) {
    // If file doesn't exist, create default config
    if (error.code === 'ENOENT') {
      console.log('No configuration found, using defaults');
      await saveConfig();
    } else {
      console.error('Error loading configuration:', error);
    }
  }
}

// Save configuration to disk
async function saveConfig() {
  try {
    await fs.writeFile(CONFIG_FILE, JSON.stringify(botConfig, null, 2), 'utf8');
    console.log('Configuration saved');
  } catch (error) {
    console.error('Error saving configuration:', error);
  }
}

// Register slash commands
async function registerCommands() {
  try {
    const commands = [
      {
        name: 'setup',
        description: 'Setup the RSVP tracking channel',
      },
      {
        name: 'watchgroup',
        description: 'Add a Meetup group to watch',
        options: [
          {
            name: 'group_urlname',
            description: 'The Meetup group URL name (found in the group URL)',
            type: 3, // STRING
            required: true,
          },
        ],
      },
      {
        name: 'unwatchgroup',
        description: 'Remove a Meetup group from watching',
        options: [
          {
            name: 'group_urlname',
            description: 'The Meetup group URL name to stop watching',
            type: 3, // STRING
            required: true,
          },
        ],
      },
      {
        name: 'listgroups',
        description: 'List all Meetup groups being watched',
      },
      {
        name: 'refresh',
        description: 'Manually refresh all events and RSVPs',
      }
    ];
    
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    console.log('Registering slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.DISCORD_CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands },
    );
    
    console.log('Slash commands registered!');
  } catch (error) {
    console.error('Error registering slash commands:', error);
  }
}

// Handle slash commands
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isCommand()) return;
  
  const { commandName } = interaction;
  
  try {
    if (commandName === 'setup') {
      const channel = interaction.guild.channels.cache.get(process.env.RSVP_CHANNEL_ID);
      if (!channel) {
        await interaction.reply({
          content: 'RSVP channel not found. Please check your RSVP_CHANNEL_ID in .env file.',
          ephemeral: true
        });
        return;
      }
      
      await interaction.reply({
        content: `RSVP tracking setup for channel ${channel.name}. Use /watchgroup to start tracking Meetup groups.`,
        ephemeral: true
      });
    }
    else if (commandName === 'watchgroup') {
      const groupUrlName = interaction.options.getString('group_urlname');
      
      // Validate the group exists
      try {
        const group = await fetchMeetupGroup(groupUrlName);
        
        // Check if already watching
        if (botConfig.watchedGroups.includes(groupUrlName)) {
          await interaction.reply({
            content: `Already watching ${group.name}. Use /refresh to update now.`,
            ephemeral: true
          });
          return;
        }
        
        // Add to watched groups
        botConfig.watchedGroups.push(groupUrlName);
        await saveConfig();
        
        await interaction.reply({
          content: `Now watching Meetup group: ${group.name} (${groupUrlName}). I'll start tracking upcoming events automatically.`,
          ephemeral: true
        });
        
        // Force a refresh
        findUpcomingEvents();
      } catch (error) {
        console.error(`Error validating group ${groupUrlName}:`, error);
        await interaction.reply({
          content: `Error: Could not find or access the Meetup group "${groupUrlName}". Please check the URL name and your API permissions.`,
          ephemeral: true
        });
      }
    }
    else if (commandName === 'unwatchgroup') {
      const groupUrlName = interaction.options.getString('group_urlname');
      
      // Check if we're watching this group
      const index = botConfig.watchedGroups.indexOf(groupUrlName);
      if (index === -1) {
        await interaction.reply({
          content: `Not watching any group named "${groupUrlName}".`,
          ephemeral: true
        });
        return;
      }
      
      // Remove from watched groups
      botConfig.watchedGroups.splice(index, 1);
      
      // Remove any tracked events for this group
      Object.keys(botConfig.trackedEvents).forEach(eventId => {
        if (botConfig.trackedEvents[eventId].groupUrlName === groupUrlName) {
          delete botConfig.trackedEvents[eventId];
          // Also remove any channel messages for this event
          if (botConfig.channelMessages[eventId]) {
            delete botConfig.channelMessages[eventId];
          }
        }
      });
      
      await saveConfig();
      
      await interaction.reply({
        content: `Stopped watching Meetup group "${groupUrlName}" and removed any tracked events from this group.`,
        ephemeral: true
      });
    }
    else if (commandName === 'listgroups') {
      if (botConfig.watchedGroups.length === 0) {
        await interaction.reply({
          content: 'Not watching any Meetup groups yet. Use /watchgroup to add a group.',
          ephemeral: true
        });
        return;
      }
      
      // Get details about each group
      const groupPromises = botConfig.watchedGroups.map(fetchMeetupGroup);
      const groups = await Promise.all(groupPromises);
      
      let message = '**Watched Meetup Groups:**\n\n';
      groups.forEach(group => {
        message += `- **${group.name}** (${group.urlname})\n`;
        message += `  ${group.members} members · ${group.link}\n\n`;
      });
      
      // Add tracked events count
      const eventCount = Object.keys(botConfig.trackedEvents).length;
      message += `\nCurrently tracking ${eventCount} upcoming events from these groups.`;
      
      await interaction.reply({ content: message });
    }
    else if (commandName === 'refresh') {
      await interaction.reply({
        content: 'Manually refreshing all groups and events...',
        ephemeral: true
      });
      
      await findUpcomingEvents();
      await updateAllEvents();
    }
  } catch (error) {
    console.error(`Error handling command ${commandName}:`, error);
    await interaction.reply({
      content: 'An error occurred while processing your command.',
      ephemeral: true
    });
  }
});

// Start polling the Meetup API at regular intervals
function startPolling() {
  // Immediately check once on startup
  findUpcomingEvents();
  
  // Then set up regular polling
  const interval = parseInt(process.env.POLL_INTERVAL) || 60000; // Default: check every minute
  setInterval(findUpcomingEvents, interval * 5); // Check for new events every 5 intervals
  setInterval(updateAllEvents, interval); // Check for RSVP updates every interval
  console.log(`Polling Meetup API every ${interval / 1000} seconds for RSVPs`);
  console.log(`Checking for new events every ${(interval * 5) / 1000} seconds`);
}

// Find upcoming events for all watched groups
async function findUpcomingEvents() {
  if (botConfig.watchedGroups.length === 0) {
    console.log('No groups being watched yet.');
    return;
  }
  
  try {
    for (const groupUrlName of botConfig.watchedGroups) {
      const events = await fetchUpcomingEvents(groupUrlName);
      
      for (const event of events) {
        // Only track events if they're not already being tracked
        if (!botConfig.trackedEvents[event.id]) {
          console.log(`Found new event: ${event.name} (${event.id}) in group ${groupUrlName}`);
          
          // Initialize tracking for this event
          botConfig.trackedEvents[event.id] = {
            groupUrlName,
            eventName: event.name,
            eventDate: event.local_date,
            eventTime: event.local_time,
            venue: event.venue ? event.venue.name : 'TBA',
            link: event.link,
            rsvps: {}
          };
          
          // Save new event to config
          await saveConfig();
          
          // Announce the new event
          await announceNewEvent(event);
        }
      }
    }
  } catch (error) {
    console.error('Error finding upcoming events:', error);
  }
}

// Update all tracked events
async function updateAllEvents() {
  const eventIds = Object.keys(botConfig.trackedEvents);
  
  if (eventIds.length === 0) {
    return;
  }
  
  for (const eventId of eventIds) {
    await updateEventRsvps(eventId);
  }
}

// Update RSVPs for a specific event
async function updateEventRsvps(eventId) {
  const eventData = botConfig.trackedEvents[eventId];
  if (!eventData) {
    console.error(`No event data found for event ID ${eventId}`);
    return;
  }
  
  try {
    // Get the latest event info to check if it's past
    const event = await fetchEventDetails(eventData.groupUrlName, eventId);
    
    // If the event has passed, stop tracking it after a day
    const eventDate = new Date(`${event.local_date}T${event.local_time || '00:00'}`);
    const now = new Date();
    if (eventDate < now && (now - eventDate) > 24 * 60 * 60 * 1000) {
      console.log(`Event ${event.name} (${eventId}) has passed. Removing from tracking.`);
      delete botConfig.trackedEvents[eventId];
      if (botConfig.channelMessages[eventId]) {
        delete botConfig.channelMessages[eventId];
      }
      await saveConfig();
      return;
    }
    
    // Fetch RSVPs
    const rsvps = await fetchRsvpsFromMeetup(eventData.groupUrlName, eventId);
    const previousRsvps = eventData.rsvps || {};
    const newRsvps = [];
    
    // Check for new RSVPs
    for (const rsvp of rsvps) {
      const userId = rsvp.member.id;
      
      if (!previousRsvps[userId]) {
        // This is a new RSVP
        previousRsvps[userId] = {
          name: rsvp.member.name,
          response: rsvp.response,
          time: rsvp.updated
        };
        
        if (!isFirstRun) {
          newRsvps.push(rsvp);
        }
      }
    }
    
    // Check for canceled RSVPs
    const currentRsvpIds = new Set(rsvps.map(rsvp => rsvp.member.id));
    for (const userId in previousRsvps) {
      if (!currentRsvpIds.has(userId)) {
        // This RSVP was canceled
        delete previousRsvps[userId];
      }
    }
    
    // Update stored RSVPs
    botConfig.trackedEvents[eventId].rsvps = previousRsvps;
    await saveConfig();
    
    // Update the event message and announce new RSVPs
    await updateEventMessage(eventId, event, rsvps, newRsvps);
  } catch (error) {
    console.error(`Error updating RSVPs for event ${eventId}:`, error);
  }
}

// Announce a new event
async function announceNewEvent(event) {
  try {
    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) {
      console.error('Guild not found. Check your GUILD_ID in .env file.');
      return;
    }
    
    const channel = guild.channels.cache.get(process.env.RSVP_CHANNEL_ID);
    if (!channel) {
      console.error('RSVP channel not found. Check your RSVP_CHANNEL_ID in .env file.');
      return;
    }
    
    const eventDate = new Date(`${event.local_date}T${event.local_time || '00:00'}`);
    const formattedDate = eventDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const formattedTime = event.local_time ? 
      eventDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      }) : 'TBA';
    
    const venueName = event.venue ? event.venue.name : 'TBA';
    
    let message = `# 🆕 New Meetup Event: ${event.name}\n\n`;
    message += `**Date:** ${formattedDate}\n`;
    message += `**Time:** ${formattedTime}\n`;
    message += `**Location:** ${venueName}\n\n`;
    message += `**Event Link:** ${event.link}\n\n`;
    message += `Use the link above to RSVP! I'll keep track of who's attending and post updates here.`;
    
    // Send the announcement
    await channel.send(message);
    
    // Then create or update the event's dedicated message
    await updateEventMessage(event.id, event, []);
  } catch (error) {
    console.error('Error announcing new event:', error);
  }
}

// Update or create the event message
async function updateEventMessage(eventId, eventInfo, rsvps, newRsvps = []) {
  try {
    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) {
      console.error('Guild not found. Check your GUILD_ID in .env file.');
      return;
    }
    
    const channel = guild.channels.cache.get(process.env.RSVP_CHANNEL_ID);
    if (!channel) {
      console.error('RSVP channel not found. Check your RSVP_CHANNEL_ID in .env file.');
      return;
    }
    
    // Create the updated RSVP message content
    const messageContent = formatRsvpMessage(eventInfo, rsvps);
    
    // If we've already sent a message, update it; otherwise, send a new one
    if (botConfig.channelMessages[eventId]) {
      try {
        const message = await channel.messages.fetch(botConfig.channelMessages[eventId]);
        await message.edit(messageContent);
      } catch (error) {
        console.error(`Could not find previous message for event ${eventId}. Sending a new one.`);
        const message = await channel.send(messageContent);
        botConfig.channelMessages[eventId] = message.id;
        await saveConfig();
      }
    } else {
      const message = await channel.send(messageContent);
      botConfig.channelMessages[eventId] = message.id;
      await saveConfig();
    }
    
    // If we have new RSVPs and this isn't the first run, announce them
    if (newRsvps.length > 0 && !isFirstRun) {
      for (const rsvp of newRsvps) {
        await channel.send(
          `🎉 **${rsvp.member.name}** just RSVP'd ${rsvp.response} to **${eventInfo.name}**!`
        );
      }
    }
  } catch (error) {
    console.error(`Error updating event message for event ${eventId}:`, error);
  }
}

// Format the RSVP message
function formatRsvpMessage(eventInfo, rsvps) {
  const eventDate = eventInfo.local_date ? new Date(`${eventInfo.local_date}T${eventInfo.local_time || '00:00'}`) : new Date();
  const formattedDate = eventDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  const formattedTime = eventInfo.local_time ? 
    eventDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    }) : 'TBA';
  
  const venueName = eventInfo.venue ? eventInfo.venue.name : 'TBA';
  
  let message = `# 📅 ${eventInfo.name || 'Upcoming Event'}\n\n`;
  message += `**Date:** ${formattedDate}\n`;
  message += `**Time:** ${formattedTime}\n`;
  message += `**Location:** ${venueName}\n\n`;
  
  // Add the event link
  message += `**Event Link:** ${eventInfo.link || `https://meetup.com/${eventInfo.group.urlname}/events/${eventInfo.id}`}\n\n`;
  
  // Add RSVPs count
  message += `## Attendees (${rsvps.length})\n\n`;
  
  if (rsvps.length === 0) {
    message += 'No one has RSVP\'d yet. Be the first!';
  } else {
    // Sort RSVPs alphabetically by name
    rsvps.sort((a, b) => a.member.name.localeCompare(b.member.name));
    
    // List all RSVPs
    for (const rsvp of rsvps) {
      message += `- ${rsvp.member.name}\n`;
    }
  }
  
  // Add footer with timestamp
  message += `\n_Last updated: ${new Date().toLocaleString()}_`;
  
  return message;
}

// Fetch Meetup group details
async function fetchMeetupGroup(groupUrlName) {
  try {
    const url = `https://api.meetup.com/${groupUrlName}`;
    const response = await axios.get(url, {
      params: {
        key: process.env.MEETUP_API_KEY
      }
    });
    
    return response.data;
  } catch (error) {
    console.error(`Error fetching group details for ${groupUrlName}:`, error);
    throw error;
  }
}

// Fetch upcoming events from the Meetup API
async function fetchUpcomingEvents(groupUrlName) {
  try {
    const url = `https://api.meetup.com/${groupUrlName}/events`;
    const response = await axios.get(url, {
      params: {
        key: process.env.MEETUP_API_KEY,
        status: 'upcoming',
        page: 10  // Fetch up to 10 upcoming events
      }
    });
    
    return response.data;
  } catch (error) {
    console.error(`Error fetching upcoming events for group ${groupUrlName}:`, error);
    return [];
  }
}

// Fetch event details from Meetup
async function fetchEventDetails(groupUrlName, eventId) {
  try {
    const url = `https://api.meetup.com/${groupUrlName}/events/${eventId}`;
    const response = await axios.get(url, {
      params: {
        key: process.env.MEETUP_API_KEY
      }
    });
    
    return response.data;
  } catch (error) {
    console.error(`Error fetching event details for event ${eventId}:`, error);
    return {
      name: 'Unknown Event',
      local_date: 'Unknown',
      local_time: 'Unknown',
      venue: { name: 'Unknown' }
    };
  }
}

// Fetch RSVPs from the Meetup API
async function fetchRsvpsFromMeetup(groupUrlName, eventId) {
  try {
    const url = `https://api.meetup.com/${groupUrlName}/events/${eventId}/rsvps`;
    const response = await axios.get(url, {
      params: {
        key: process.env.MEETUP_API_KEY,
        fields: 'member_photo',
        response: 'yes'  // Only get "yes" RSVPs
      }
    });
    
    return response.data;
  } catch (error) {
    console.error(`Error fetching RSVPs for event ${eventId}:`, error);
    return [];
  }
}

// First time flag to avoid spamming announcements on startup
setTimeout(() => {
  isFirstRun = false;
  console.log('Initial setup complete, now tracking RSVP changes');
}, 60000);

// Add health check endpoint for Docker
const http = require('http');

// Create a simple health check server
const healthCheckPort = process.env.HEALTHCHECK_PORT || 8080;
const healthServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    // Check if the bot is connected to Discord
    const isHealthy = client && client.ws && client.ws.status === 0;
    
    if (isHealthy) {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'healthy', uptime: process.uptime() }));
    } else {
      res.writeHead(503);
      res.end(JSON.stringify({ status: 'unhealthy', reason: 'Discord connection issue' }));
    }
  } else {
    res.writeHead(404);
    res.end();
  }
});

// Start health check server
healthServer.listen(healthCheckPort, () => {
  console.log(`Health check server listening on port ${healthCheckPort}`);
});

// Start the bot
client.login(process.env.DISCORD_TOKEN);