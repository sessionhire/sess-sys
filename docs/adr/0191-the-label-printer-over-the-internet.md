# ADR 0191: The label printer over the internet

- **Status:** accepted
- **Date:** 23 November 2026
- **Asked for by:** Colly, 23 November 2026: a more direct way to print on the
  ZT411 than Zebra Browser Print, with the printer connecting to the app,
  so any device prints, and the printer's status shown beside Print.
  "We don't have the printer yet but prepare everything you can ahead of
  time", and the app's address will move to sessionhire.com.
- **Builds on:** [ADR 0178](0178-printing-on-the-zebra-zt411.md) (labels in
  ZPL, through Browser Print or a file), [ADR 0107](0107-trackers-on-expensive-kit.md)
  (a way in from outside, shut without its key).

## Context

Since ADR 0178 the ZT411 prints a whole run in one tap, but only from the
one computer running Zebra Browser Print, which reaches the printer on the
warehouse network. A phone can only download the file. Counting and
labelling together (ADR 0175) happens on phones, in the bays.

Zebra's Link-OS printers, the ZT411 among them, have **WebLink**: the
printer opens a secure WebSocket out to a server it's given and keeps it
open, and the server sends it work. Nothing has to reach into the
warehouse network, and no computer has to be on. Zebra documents it in an
application note ("Weblink / WebSocket Endpoint Configuration") and the
Programming Guide's "Using Weblink"; its own server for it is a Java
servlet in the Link-OS SDK. What those say, and what we rely on:

- The printer connects to `weblink.ip.conn1.location` (https only), asking
  for the subprotocol `v1.weblink.zebra.com`; the answer must carry
  `Content-Length: 0` or it drops the connection.
- If the server answers 401, it signs in with the triplet in
  `weblink.ip.conn1.authentication.add` ("host user password").
- Its first message on that main channel is `{"discovery_b64": …}`. The
  server asks it on the main channel to `{"open": "v1.raw.zebra.com"}` (ZPL,
  as port 9100) or `"v1.config.zebra.com"` (JSON settings, as port 9200);
  each is a new connection, which first says
  `{"unique_id", "channel_name", "channel_id"}`.
- It takes **binary frames only**: a text frame closes the connection
  (1003). It pings about once a minute and gives up after three missed.
- `{"configure_alert": "ALL MESSAGES,SDK,Y,Y,,,N"}` on the main channel has
  it say there whenever its state changes (head open, media out…).
- **Certificates.** It checks the server's certificate against its clock
  and the authorities it trusts. Out of the box that's Zebra's own CA; since
  Link-OS 5.2 it trusts a CA given as `E:WEBLINK1_CA.NRD` (Zebra support
  article 000019334). Zebra now recommends your own or a publicly trusted
  certificate over a Zebra-signed one.

## Decision

- **The printer connects to the app** at `/api/printer/weblink/`
  (`server/src/printer/`), on the app's own address, through Railway, with
  no other service. The server keeps the connection, opens a raw channel to
  print (kept open) and a config channel to ask how it is (closed after),
  and asks for alerts. Everything it sends is bytes.
- **Status beside Print.** The server asks `zpl.system_status` (as ~HQES),
  the printer's name and serial when it connects, a moment after anything
  it says changed, after each print, and every minute. It's read into
  problems (out of labels or ribbon, head open, paused, too hot, a head
  fault) and warnings (labels low, calibrate, clean or replace the head),
  shown as one pill: **Ready** quiet, a problem in the bad tone with what to
  do, a warning amber, **Not connected** grey (`shared/src/printer.ts`). A
  run's page asks every 10 seconds while it's in view. Labels sent to a
  printer with a problem wait in it and print once it's put right, as
  printers do; the result says so.
- **Print, from any device.** On a run's page and an item's, **Print N
  labels** sends through the server when the printer is connected and the
  person can change stock; **Print from this computer** (Browser Print)
  and **Download for the ZT411** stay beside it, the first only where
  Browser Print answers. Two runs sent at once print one after the other.
- **Pairing, shut by default.** Admin › Connections › **Label printer** has
  the switch (off until the office turns it on) and **Make the setup
  file**: a new random password (kept as a hash, shown once), the address
  from `PUBLIC_URL`, the certificate, and a restart, as commands the
  printer reads (`server/src/printer/setup.ts`). It goes to the printer
  through Browser Print from the same card, or as a download. The first
  printer to connect with it is the paired one by its serial number; any
  other with the same file is turned away. A new file, **Forget**, or the
  switch off disconnect it at once. The password is left out of the export.
- **The certificate is found, not configured.** Making the file looks at
  the certificate the app's address presents, follows it up to its root
  authority among those Node trusts, and puts that root in the file as
  `WEBLINK1_CA.NRD` (`~DYE:WEBLINK1_CA,B,NRD,…`). Whoever serves the
  address, and whichever authority signs it, the file carries the right
  one. It's also a download on its own, for Zebra's tools.
- **The address isn't written anywhere.** The location in the file is the
  app's address when it was made; the card says when that differs from
  the app's address now, as it will when `PUBLIC_URL` moves to
  sessionhire.com, and a new file fixes it. The guide says so.
- **A pretend ZT411** (`server/test/fake-zt411.ts`) keeps to WebLink as
  Zebra describes it, and fails as the printer would (no Content-Length 0,
  a text frame). The server tests and a browser test print through it, and
  `npm run printer:pretend -w server -- <location> <password>` connects one
  to a running app. The setup guide for the printer is
  [docs/zt411-weblink-setup.md](../zt411-weblink-setup.md).

## Consequences

- Any phone signed in prints a run, and nobody sends a run to a printer
  with its head open without seeing so.
- Railway runs one copy of the server, which holds the printer's
  connection. Were it ever to run two, a print could reach the copy
  without it; that would need the printer's connection shared between them.
- **Not yet tried on a real printer.** What's unproven until it arrives:
  the serial number's place in the discovery packet (the channels' own
  `unique_id` stands in if it's wrong), that `~DY` stores the certificate
  under that name on its firmware (the guide has the check, and the file on
  its own), that its TLS settles with Railway's, and that Railway passes
  the 101's `Content-Length: 0` through. Each fails loudly in the
  printer's WebLink log, which the file turns on, and printing falls back
  to Browser Print and the file meanwhile.
- The printer's WebLink connection 2 is left free for anything else.
