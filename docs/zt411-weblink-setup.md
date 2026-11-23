# Setting up the ZT411 to print over the internet

The Zebra ZT411 can connect to the app by itself, over the internet, using
Zebra's **WebLink** ([Decision 0191](adr/0191-the-label-printer-over-the-internet.md)).
Once it has, **Print** on any phone or computer signed in to the app sends
labels straight to it, and beside Print the app shows whether it's ready,
out of labels, out of ribbon or has its head open. Zebra Browser Print on the
warehouse computer and **Download for the ZT411** keep working as before, for
when the printer is offline.

You do this once, when the printer arrives, and again only if the app's
address changes (see the end). It takes about half an hour, most of it
loading labels and calibrating.

**Before you start:** the setup file holds the printer's password. Send it to
the printer and delete it; don't email it or put it in a chat. If it goes
astray, make a new one: that stops the old password working.

## 1. Unbox, load and calibrate

1. Put the printer where it will live, plug in power and a network cable
   (the warehouse network, with internet access). Turn it on.
2. Load the **ribbon** (the diagram inside the cover shows its path) and the **labels** (50 × 25,
   100 × 25 or 25 × 25 mm die-cut). Close the print head firmly.
3. Calibrate, from the printer's screen (**Menu › Print › Sensors**). It feeds a few
   labels and learns where each one starts. Do this again whenever you change
   to a different size of label.
4. Check its print method is **thermal transfer** (with ribbon), not direct
   thermal (**Menu › Print**).
5. Print a configuration label (**Menu › Settings**, print the settings). It shows the printer's IP
   address, firmware and **Link-OS version**, which needs to be **5.2 or
   later** (a new ZT411 has 6 or 7).

The menu names are as on the ZT411's touch screen; the quick start guide in
the box has pictures of each step.

The app's labels are drawn for a **300 dpi** print head (the ZT411 Colly
ordered). The configuration label says which yours has under the print head
resolution: a 203 or 600 dpi head would print labels the wrong size, so
tell Claude before the first run if it isn't 300.

## 2. Set the date and time

The printer checks the app's certificate against its own clock, and won't
connect if its clock is out by years. On the screen, **Menu › Settings ›
Date and time**, or on its web page (step 4) under **View and modify printer
settings › General setup**. The ZT411 keeps the time while it's off.

## 3. Turn it on in the app and make the setup file

1. In the app, **Admin › Connections › Label printer**: turn on **Print over
   the internet**.
2. Press **Make the setup file**. It's shown once: leave the page open until
   it's on the printer.

The file sets:

- where the printer connects, which is the app's own address with
  `/api/printer/weblink/` after it (shown on the card);
- the printer's user name and password for that address;
- to try again every 10 seconds if the connection drops, and to keep a log
  of the last 100 things that happened on it, for when it won't connect;
- the certificate the printer needs to trust the app's address
  (`WEBLINK1_CA.NRD`), which the app finds by itself; and then
- restarts the printer, which it needs before the new settings take.

## 4. Send the file to the printer

Any one of these. The first is the easiest if Zebra Browser Print is already
set up on the warehouse computer with the ZT411 as its default printer.

- **From the app, through Browser Print:** on that computer, the card shows
  **Send to the printer**. Press it. The printer restarts.
- **Zebra Setup Utilities** (free, Windows): choose the printer, **Open
  Communication with Printer**, **Read File**, pick `zt411-setup.zpl`,
  **Send to Printer**.
- **Zebra Printer Setup Utility app** on a phone (Android or iPhone), joined
  to the printer by Bluetooth or the network: **Files › Send File**.

Within a minute of restarting, the card in Admin shows the printer
**Ready**, with its serial number. From then on only that printer can
connect with that file: another printer sent the same file is turned away.

## 5. Try it

Stock › Labels, open a run (or make a short one), and on **On the ZT411**
press **Print**. Then open the print head: within a few seconds the app shows
**Head open** beside Print. Close it, and it's **Ready** again.

## If it won't connect

The card says **Not connected** or keeps saying **Waiting for it to connect**.

1. **Is the printer online?** Its screen shows a network address, and the
   configuration label shows the WebLink address as the app's, ending in
   `/api/printer/weblink/` (with the slash).
2. **Its log.** On its web page, or sent from Zebra Setup Utilities:
   `! U1 getvar "weblink.logging.entries"`. The usual answers:
   - *"SSL certificate problem: unable to get local issuer certificate"*: the
     printer doesn't trust the app's certificate, so the certificate in the
     file didn't take. Check it's there: `! U1 getvar "file.dir"` should
     list `E:WEBLINK1_CA.NRD`. If not, Zebra Setup Utilities can store a
     file on the printer as it is (**Files**, send and store, to E:): use
     **Download the certificate** on the Admin card, which saves it under
     that name, then restart the printer. If it's there and the log still
     says this, tell Claude what the log says.
   - *"certificate has expired"* or *"not yet valid"*: the printer's date
     and time are wrong (step 2).
   - *"subject name does not match"*: the address on the printer isn't the
     app's. Make a new setup file and send it.
   - *401* again and again: the password is from an older file. Make a new
     one and send it.
3. **Is it turned on in the app?** Admin › Connections › Label printer,
   **Print over the internet**.

Whatever happens, labels still print the old ways: **Print** through
Browser Print on the warehouse computer, or **Download for the ZT411**.

## When the app's address changes

The app is at server.letissier.ie for now, and will move to an address on
sessionhire.com. The printer doesn't follow by itself: it keeps going to the
address in its setup file. After the move (with `PUBLIC_URL` in Railway set
to the new address):

1. Admin › Connections › Label printer says *the app's address has changed
   since the setup file was made*.
2. Press **Make a new setup file** and send it to the printer (step 4). It
   carries the new address, a new password for it, and the certificate the
   new address uses, which may come from a different authority.

If the old address still reaches the app for a while, the printer keeps
printing until you do; once it stops, the printer shows **Not connected**
until it has the new file.

## Turning it off

Turn off **Print over the internet**: the printer is disconnected at once and
can't connect again until it's turned back on. **Forget the printer** also
stops its password working, for good: it needs a new setup file after.
