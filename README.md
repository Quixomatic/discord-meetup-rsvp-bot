# Discord Meetup RSVP Bot

This Discord bot connects to the Meetup.com API and automatically tracks multiple Meetup groups, posts upcoming events, and maintains up-to-date RSVP lists for each event.

## Features

- **Multi-Group Tracking**: Add multiple Meetup groups to watch
- **Automatic Event Discovery**: Finds and tracks upcoming events without manual configuration
- **Real-time RSVP Tracking**: Maintains an up-to-date list of attendees for each event
- **RSVP Announcements**: Announces when someone new RSVPs to an event
- **Event Cleanup**: Automatically stops tracking past events after 24 hours
- **Configuration Persistence**: Saves all settings and state between restarts

## Prerequisites

- Node.js (v16.9.0 or higher)
- npm or yarn
- A Discord account with a server you have admin permissions on
- A Meetup.com account with API access
- Your Meetup group's URL name and event ID

## Setup

### Configuration

Create a `.env` file with your settings using the `.env.example` as a template:

```bash
cp .env.example .env
nano .env  # Edit with your favorite text editor
```

For detailed information about all available configuration options, see the [ENV-DOCUMENTATION.md](ENV-DOCUMENTATION.md) file.

### Required Settings
- Discord bot token and client ID
- Discord server (Guild) ID
- RSVP channel ID
- Meetup API key

### Docker User Settings
The UID and GID settings in the `.env` file control which user and group the Docker container runs as:

```
UID=1000  # Set to match your host user's UID
GID=1000  # Set to match your host user's GID
```

You can find your current UID and GID with:
```bash
id -u  # Shows your UID
id -g  # Shows your GID
```

## Docker Permissions

This bot is designed to run with configurable user and group IDs to match your host system's permissions.

### Configuring User and Group IDs

The bot uses these environment variables for permissions:

- `UID`: User ID the container will run as (defaults to 1000)
- `GID`: Group ID the container will run as (defaults to 1000)

You can set these in your `.env` file:

```
UID=1000
GID=1000
```

Or override them when running the container:

```bash
UID=$(id -u) GID=$(id -g) docker-compose up -d
```

### Setting up Data Directory Permissions

To ensure proper file access, set permissions on your data directory:

```bash
# Create data directory if it doesn't exist
mkdir -p ./data

# Set ownership to match the UID/GID you're using
chown -R $UID:$GID ./data

# Set appropriate permissions
chmod 755 ./data
```

### Using with TrueNAS Scale

TrueNAS Scale typically uses specific user/group mappings for containers. You can adjust the UID/GID in your environment file to match your TrueNAS user permissions.

## Docker Setup with GitHub Container Registry

You can pull the pre-built Docker image directly from GitHub Container Registry:

```bash
# Pull the latest image
docker pull ghcr.io/your-username/discord-meetup-rsvp-bot:latest

# Create a directory for persistent data
mkdir -p ./discord-bot-data

# Create a .env file with your configuration
# (See .env.example for required variables)

# Run the container
docker run -d \
  --name discord-meetup-bot \
  --restart unless-stopped \
  --env-file .env \
  -v ./discord-bot-data:/app/data \
  ghcr.io/your-username/discord-meetup-rsvp-bot:latest
```

### Using with Docker Compose

Create a `docker-compose.yml` file:

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

Then run:

```bash
docker-compose up -d
```

### Using with TrueNAS Scale and Dockge

1. Clone this repository into a directory on your TrueNAS Scale server
2. Copy `.env.example` to `.env` and fill in your details
3. Add the container to Dockge by pointing it to the directory with your docker-compose.yml file
4. Start the container through the Dockge interface

For manual Docker setup without Dockge:
```bash
# Fill in your .env file first
docker-compose up -d
```

The container will automatically restart unless explicitly stopped.

### Standard Setup (without Docker)

### 1. Create a Discord Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to the "Bot" tab and click "Add Bot"
4. Under the "Privileged Gateway Intents" section, enable:
   - SERVER MEMBERS INTENT
   - MESSAGE CONTENT INTENT
5. Under "Token", click "Reset Token" and copy your bot token
6. Under "OAuth2" > "URL Generator", select:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Manage Messages`, `Embed Links`, `Read Message History`
7. Copy the generated URL and use it to invite the bot to your server

### 2. Get Meetup API Key

1. Go to [Meetup API Documentation](https://www.meetup.com/api/guide)
2. Follow the instructions to get your API key

### 3. Set Up the Bot

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Copy the `.env.template` file to `.env`:
   ```
   cp .env.template .env
   ```
4. Fill in your `.env` file with:
   - Discord bot token
   - Discord client ID (found in your Discord Developer Portal)
   - Your Discord server (guild) ID
   - Your desired RSVP announcement channel ID
   - Your Meetup API key
   - Your Meetup group URL name (the part after meetup.com/)
   - The event ID you want to track

### 4. Run the Bot

```
node index.js
```

For production, consider using a process manager like PM2:

```
npm install -g pm2
pm2 start index.js --name meetup-rsvp-bot
```

## Usage

Once the bot is running, use these slash commands in your Discord server:

- `/setup` - Initialize the RSVP tracking channel
- `/watchgroup [group_urlname]` - Add a Meetup group to track (e.g., `/watchgroup tech-enthusiasts`)
- `/unwatchgroup [group_urlname]` - Remove a Meetup group from tracking
- `/listgroups` - Display all groups being watched and event counts
- `/refresh` - Manually refresh all groups and events

### Adding a Group to Watch

The `group_urlname` is the part of the Meetup URL after "meetup.com/":
`https://www.meetup.com/[group-urlname]/`

For example, if the group URL is `https://www.meetup.com/python-developers-group/`, you would use:
```
/watchgroup python-developers-group
```

### How It Works

1. Add groups to watch using `/watchgroup`
2. The bot automatically finds upcoming events for these groups
3. When new events are found, they're announced in your RSVP channel
4. For each event, a dedicated message is maintained with current RSVPs
5. New RSVPs are announced as they happen
6. Events are automatically cleaned up 24 hours after they've passed

## Troubleshooting

### Docker Issues
- Check container logs: `docker logs discord-meetup-bot`
- Verify environment variables were passed correctly in Dockge
- Make sure the container has network access to reach both Discord and Meetup APIs
- If updating the bot, rebuild the container: `docker-compose build --no-cache`

### General Issues

- If the bot isn't responding, check your `.env` file for correct values
- Make sure the bot has proper permissions in your Discord server
- Check your console for any error messages

## License

MIT