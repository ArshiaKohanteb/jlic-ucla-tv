# Host the bot on Google Cloud (free)

Runs the bot all day on Google Cloud's free "e2-micro" server. About 30 minutes, once.
Nothing here needs a terminal on your own computer: everything is in the browser.

## Before you start

- **The bot fixes merged into `main`.** The step below installs from `main`, and the bot on
  `main` before the `minyan-tv-slides` changes crashes on start.
- **Firebase key** and **published rules**: steps 2 and 3 in [README.md](README.md). The
  key is a `.json` file; keep it private, since it can change anything in the database.
- **The bot's WhatsApp number**, already in the minyan group. A prepaid SIM in a spare phone
  is safest; WhatsApp often rejects Google Voice, and the number could be banned one day.
- **A card** for Google Cloud sign-up. The server below is in the free tier; the card is for
  identity, and step 1 sets an alert so a surprise charge can't go unnoticed.

## 1. Account and budget alert

1. Go to console.cloud.google.com, sign in, and accept the terms. Skip or accept the
   free-trial credit; the server below stays free after it ends.
2. Create a project (top bar → project picker → New project), e.g. `minyan-bot`.
3. Billing → Budgets & alerts → Create budget: **$1**, alerts at 50% and 100%. You'll get an
   email if anything ever costs money.

## 2. Create the server

Compute Engine → VM instances (click Enable if asked, it takes a minute) → **Create instance**:

| Setting | Choose | Why |
|---|---|---|
| Name | `minyan-bot` | |
| Region | `us-west1` (Oregon), `us-central1` or `us-east1` | Only these are free |
| Machine type | **e2-micro** (General purpose → E2 → e2-micro) | The free one |
| Provisioning | Standard (not Spot) | Spot can be shut off any time |
| OS and storage | Change → **Debian GNU/Linux 12 (bookworm), x86/64** (not Arm64), disk type **Standard persistent disk**, 30 GB | Standard disk up to 30 GB is free; "Balanced" is not |
| Data protection | **No backups** | Snapshots cost money; the bot's login lives in the database anyway |
| Networking | Leave HTTP/HTTPS unchecked | The bot only connects out; nothing connects in |
| Observability | Uncheck **Install Ops Agent** | It uses memory the server doesn't have, and its logs can cost money |

Click **Create**. The estimate on the right shows about $6 a month for the e2-micro: that's
the price before the free tier, which is taken off on the bill. The disk should show $0.

## 3. Install the bot

Click **SSH** next to the server. A terminal opens in the browser. Paste these blocks one at
a time.

Swap space (the server has 1 GB of memory, and installing packages can use more):

```bash
sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile && echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Node 22 and git:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs git
```

The code:

```bash
git clone https://github.com/ArshiaKohanteb/jlic-ucla-tv.git ~/jlic-ucla-tv && cd ~/jlic-ucla-tv/bot && npm ci --omit=dev
```

## 4. Add the Firebase key

In the SSH window: gear (or ⋮) at the top right → **Upload file** → pick the key `.json`.
It lands in your home folder. Then:

```bash
mv ~/*.json ~/firebase-key.json && chmod 600 ~/firebase-key.json
```

(If you uploaded anything else ending in `.json`, move the key by its own name instead.)

## 5. Run it all the time

This makes the server start the bot on boot and restart it if it ever stops. `WA_GROUP` is
a word in the group's name. Every group the bot's number is in whose name contains it gets
read, so make sure no test group matches too (use a longer phrase, in quotes, like
`Environment="WA_GROUP=jlic minyan"`, if needed).

```bash
sudo tee /etc/systemd/system/minyan-bot.service > /dev/null <<EOF
[Unit]
Description=Minyan WhatsApp bot
After=network-online.target
Wants=network-online.target

[Service]
User=$USER
WorkingDirectory=$HOME/jlic-ucla-tv/bot
Environment=WA_GROUP=minyan
ExecStart=/bin/bash -c 'FIREBASE_SERVICE_ACCOUNT="\$(cat $HOME/firebase-key.json)" exec /usr/bin/node index.js'
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload && sudo systemctl enable --now minyan-bot
```

Watch it (Ctrl+C stops watching, not the bot):

```bash
journalctl -u minyan-bot -f
```

You should see "Waiting to be linked".

## 6. Link the WhatsApp number

The bot's number has to be in the group first (the group admin adds it like any contact).
Then show the QR code right in the SSH window:

```bash
cd ~/jlic-ucla-tv/bot && npm i --no-save qrcode-terminal && FIREBASE_SERVICE_ACCOUNT="$(cat ~/firebase-key.json)" node show-qr.js
```

On the bot's phone: WhatsApp (or WhatsApp Business) → Settings → Linked devices → Link a
device, and scan it. If it won't scan, make the window bigger or zoom out (Ctrl and −). When
it says "online" with the group's name, press Ctrl+C; the bot keeps running.

A dashboard admin can also scan from Dashboard → Minyan → Polls → WhatsApp. (Setting
`WA_PHONE` prints an 8-letter code for "Link with phone number instead", but WhatsApp
refused it when we set this up; the QR code worked.)

Then post a fresh poll in the group; polls from before the bot joined aren't seen.

## Day to day

- **Only one copy at a time.** Two bots on the same login keep knocking each other off
  ("stream errored out" in the log). Stop any test bot before this one runs.
- **Moving hosts** doesn't need a new scan: the login is saved in the database
  (`/waBot/auth`). Stop the old one first.
- **Update to the latest code:**
  ```bash
  cd ~/jlic-ucla-tv && git pull && cd bot && npm ci --omit=dev && sudo systemctl restart minyan-bot
  ```
- **Is it running?** `systemctl status minyan-bot`, or the WhatsApp card on the dashboard.
- **Unlinked?** The log says "logged out". Run the step 6 command and scan again.
- **Keep it linked:** WhatsApp logs out linked devices if the bot's phone hasn't been online
  for about 14 days. Open WhatsApp on that phone every week or so.
- **Stop it:** `sudo systemctl stop minyan-bot` (and `disable` to keep it off after a reboot).
- **Check billing** after the first week. If it shows a charge, it's most likely the server's
  public internet address; the bot needs one to reach WhatsApp. Everything else above is in
  the free tier.
