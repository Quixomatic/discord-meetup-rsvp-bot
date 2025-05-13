# Environment Variables Documentation

This document explains all the environment variables used by the Discord Meetup RSVP Bot.

## Discord Bot Credentials

- `DISCORD_TOKEN`: Your Discord bot token (obtained from Discord Developer Portal)
  - Required for the bot to connect to Discord's API

- `DISCORD_CLIENT_ID`: The application ID of your Discord bot (found in Developer Portal)
  - Used for registering slash commands

## Server Configuration

- `GUILD_ID`: The ID of your Discord server (right-click on server name -> Copy ID)
  - This is where the bot will operate

- `RSVP_CHANNEL_ID`: The ID of the channel where RSVPs will be posted (right-click on channel -> Copy ID)
  - All event announcements and RSVP updates will appear here

## Meetup API Configuration

- `MEETUP_API_KEY`: Your Meetup API key (obtained from Meetup.com developer settings)
  - Required to fetch event and RSVP data from Meetup

## Bot Settings

- `DATA_DIR`: Directory to store bot data and configuration
  - Default is './data' for local installs, '/app/data' for Docker

- `POLL_INTERVAL`: How often the bot checks for RSVP updates, in milliseconds
  - Default is 60000 (1 minute); lower values increase API calls

- `TZ`: Time zone for displaying dates (e.g., 'America/New_York', 'Europe/London')
  - Uses system default if not specified; format must be a valid IANA time zone

## Docker User Configuration

- `UID`: User ID the Docker container will run as
  - Default is 1000 (typical first non-root user on Linux)
  - Set this to match your host user's UID for proper volume permissions

- `GID`: Group ID the Docker container will run as
  - Default is 1000 (typical first non-root user's group on Linux)
  - Set this to match your host user's GID for proper volume permissions

## Health Check Configuration

- `HEALTHCHECK_PORT`: Port for the health check server
  - Only relevant when running in Docker
  - Default is 8080