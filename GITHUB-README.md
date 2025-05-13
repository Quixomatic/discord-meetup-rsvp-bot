# Discord Meetup RSVP Bot

<p align="center">
  <img src="https://img.shields.io/github/workflow/status/your-username/discord-meetup-rsvp-bot/Build%20and%20Publish%20Docker%20Image?style=flat-square" alt="Build Status">
  <img src="https://img.shields.io/github/license/your-username/discord-meetup-rsvp-bot?style=flat-square" alt="License">
  <img src="https://img.shields.io/github/v/release/your-username/discord-meetup-rsvp-bot?style=flat-square" alt="Latest Release">
</p>

A Discord bot that automatically tracks multiple Meetup groups, posts upcoming events, and maintains up-to-date RSVP lists. Perfect for communities that want to stay informed about Meetup events without leaving Discord.

<p align="center">
  <img src="https://via.placeholder.com/800x400?text=Discord+Meetup+Bot+Screenshot" alt="Bot Screenshot">
</p>

## Features

- **Multi-Group Tracking**: Add multiple Meetup groups to watch
- **Automatic Event Discovery**: Finds and tracks upcoming events without manual configuration
- **Real-time RSVP Tracking**: Maintains an up-to-date list of attendees for each event
- **RSVP Announcements**: Announces when someone new RSVPs to an event
- **Event Cleanup**: Automatically stops tracking past events after 24 hours
- **Configuration Persistence**: Saves all settings and state between restarts
- **Docker Support**: Easy deployment using Docker or Docker Compose
- **Health Checks**: Built-in health monitoring for reliability

## Quick Start

### Using Docker (Recommended)

```bash
# Pull the image
docker pull ghcr.io/your-username/discord-meetup-rsvp-bot:latest

# Run the container with your environment variables
docker run -d \
  --name discord-meetup-bot \
  -e DISCORD_TOKEN=your_token \
  -e DISCORD_CLIENT_ID=your_client_id \
  -e GUILD_ID=your_guild_id \
  -e RSVP_CHANNEL_ID=your_channel_id \
  -e MEETUP_API_KEY=your_meetup_api_key \
  -v ./data:/app/data \
  ghcr.io/your-username/discord-meetup-rsvp-bot:latest
```

### Using Docker Compose

1. Create a `.env` file with your credentials (see [Configuration](#configuration))
2. Use this `docker-compose.yml`:

```yaml
version: '3.8'

services:
  discord-meetup-bot:
    container_name: discord-meetup-bot
    image: ghcr.io/your-username/discord-meetup-rsvp-bot:latest
    restart: unless-stopped
    env_file: .env
    volumes:
      - ./data:/app/data
```

3. Run with `docker-compose up -d`

## Configuration

Create a `.env` file with the following variables:

```
# Required settings
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
GUILD_ID=your_discord_server_id
RSVP_CHANNEL_ID=your_rsvp_channel_id
MEETUP_API_KEY=your_meetup_api_key

# Optional settings
POLL_INTERVAL=60000  # How often to check for RSVP updates (in ms)
TZ=UTC  # Timezone for displayed dates
```

## Bot Commands

- `/setup` - Initialize the RSVP tracking channel
- `/watchgroup [group_urlname]` - Add a Meetup group to track
- `/unwatchgroup [group_urlname]` - Remove a Meetup group from tracking
- `/listgroups` - Display all groups being watched and event counts
- `/refresh` - Manually refresh all groups and events

## Screenshots

<p align="center">
  <img src="https://via.placeholder.com/400x300?text=Event+List" alt="Event List">
  <img src="https://via.placeholder.com/400x300?text=RSVP+Tracking" alt="RSVP Tracking">
</p>

## Deployment Options

### Self-hosting

Follow the standard setup instructions in the [Quick Start](#quick-start) section.

### TrueNAS Scale with Dockge

1. In Dockge, create a new stack
2. Point it to your `docker-compose.yml` and `.env` files
3. Deploy the stack

## Development

### Prerequisites

- Node.js 16+ 
- npm or yarn
- A Discord bot token
- A Meetup API key

### Setup for Development

```bash
# Clone the repository
git clone https://github.com/your-username/discord-meetup-rsvp-bot.git
cd discord-meetup-rsvp-bot

# Install dependencies
npm install

# Create .env file with your credentials
cp .env.example .env
# Edit .env with your details

# Run the bot
npm start
```

## Architecture

The bot uses:
- Discord.js for Discord API integration
- Axios for HTTP requests to Meetup API
- File system for persistent storage
- Docker for containerization
- GitHub Actions for CI/CD

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request