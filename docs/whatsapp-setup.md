# Switching on offers over WhatsApp

Offers that go on WhatsApp by themselves ([Decision 0125](adr/0125-offers-go-on-whatsapp-by-themselves.md))
are built, and stay off until you set up Session Hire's side with Meta and
turn the switch on under **Admin › Connections › Offers on WhatsApp**. Nothing
is sent to anyone before then. It goes straight to Meta: no Twilio, no other
provider, no monthly fee. Meta charges about 1.5 cent for each message
delivered to an Irish number, to a card you add in step 5.

Most of the time this takes is Meta checking the business, usually a few days.

**Before you start:** the token in step 6 and the app secret in step 7 are
passwords for the app. Paste them only into Railway, never into a chat or an
email.

## 1. A Meta business portfolio for Session Hire

1. Go to [business.facebook.com](https://business.facebook.com) and sign in
   with a Facebook account you'll keep (yours is fine; the business is what
   owns everything).
2. Create a business portfolio called **Session Hire**, with the business
   email on sessionhire.com.

## 2. Verify the business

In **Business settings › Security centre**, start **Business verification**.
Meta asks for:

- the company's legal name and address, as the CRO has them;
- a document showing them: the CRO certificate of incorporation, or a recent
  utility bill or bank statement in the company's name;
- the website, **sessionhire.com**, and a way to confirm you control it: an
  email to an address on sessionhire.com, or a line added to the domain's DNS.

Verification is what lets "Session Hire" show as the sender's name, and lifts
the limit on how many people the app can start a conversation with in a day.

## 3. The phone number

The number freelancers will see the offers come from. Two ways, still to
decide:

- **A new number**, used only for this. It can be a landline or a mobile, but
  it mustn't be on WhatsApp already (or must be taken off it first), and it
  has to receive one text or call with a code while you set it up.
- **The office's existing WhatsApp number**, if the office already uses the
  WhatsApp Business app on a number crew know. Meta's *coexistence* keeps the
  app working on the office phone alongside the app's messages, and brings
  six months of chats across.

## 4. Make a Meta app and add WhatsApp

1. Go to [developers.facebook.com](https://developers.facebook.com) ›
   **My apps** › **Create app**. Choose **Other**, then **Business**, name it
   **Session Hire app**, and pick the Session Hire portfolio.
2. On the app's page, add **WhatsApp** and follow **Set up**. Choose the
   Session Hire portfolio, then **Add phone number**, with the number from
   step 3 and the display name **Session Hire**. Meta sends the number a code.
3. Meta also gives a **test number** with up to five phones it may message.
   It's fine for a first try before the real number is ready.

## 5. Add a card

In **WhatsApp Manager › Payment settings**, add the company card. Choose
**euro**: it can't be changed later.

## 6. A token that doesn't expire

1. In **Business settings › Users › System users**, add one called
   **sess-sys**, role **Admin**.
2. **Assign assets**: the Session Hire app (full control), and the WhatsApp
   account (full control).
3. **Generate new token**, for the Session Hire app, never expiring, with
   **whatsapp_business_messaging** and **whatsapp_business_management** ticked.
   Copy it.

## 7. Put it in Railway

On the **shserver** service, **Variables**:

| Variable | Where it comes from |
| --- | --- |
| `WHATSAPP_TOKEN` | The token from step 6. |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp › API setup in the Meta app: the **Phone number ID** under the number (a long number, not the phone number itself). |
| `WHATSAPP_APP_SECRET` | The Meta app's **App settings › Basic › App secret**. |
| `WHATSAPP_VERIFY_TOKEN` | Any long word you make up, such as a password from a password manager. You'll paste the same into Meta in step 8. |

Railway redeploys. **Admin › Status › WhatsApp** then shows the number and
the name as Meta has them.

## 8. Tell Meta where answers go

In the Meta app, **WhatsApp › Configuration › Webhook**, **Edit**:

- **Callback URL:** the address shown on the WhatsApp card under Admin ›
  Connections (it ends in `/whatsapp/hook`).
- **Verify token:** the word you made up for `WHATSAPP_VERIFY_TOKEN`.

Then **Manage** the webhook fields and subscribe to **messages**. This is
how a Yes or No pressed on WhatsApp comes back to the app, with "delivered"
and "read" for each offer. Meta checks the address as you save it: if it
says it couldn't, make sure Railway has redeployed with the verify token.

## 9. The offer's template

In **WhatsApp Manager › Message templates › Create template**:

- **Category:** Utility. **Name:** `job_offer`. **Language:** English (UK).
- **Body**, exactly, with its eight blanks:

  ```
  Hi {{1}}, are you free for {{2}}?

  Role: {{3}}
  Days: {{4}}
  Call time: {{5}}
  Venue: {{6}}
  Rate: {{7}}
  Answer by: {{8}}

  Tap a button to answer, or see the details to pick some of the days or ask about the rate.
  ```

  Meta asks for an example of each blank: Aoife · Electric Picnic (Build) ·
  Audio tech · Fri 2 Oct · 08:00 · Stradbally Hall · €250 a day · Wed 30 Sep.
- **Footer:** `Session Hire. Turn these off on your page.`
- **Buttons**, in this order:
  1. Quick reply: **Yes, I can do it**
  2. Quick reply: **No, I can't**
  3. Visit website: **See the details**, dynamic URL,
     `https://<the app's address>/f/{{1}}` (the app's address is the start
     of the webhook address in step 8). Example: any long code.

**Two more templates**, for when a job's crew were asked before the client
said yes. The offer itself says so with **HOLD** before the job's name, so
the offer's template doesn't change. HOLD is short for "hold the day": the
ask to keep the day free until the client says yes. It never means the job
is on hold, so none of these templates says that
([ADR 0150](adr/0150-hold-means-hold-the-day.md)).

`job_confirmed`, Utility, English (UK):

```
Hi {{1}}, {{2}} is confirmed: the client has said yes, so it's going ahead.

Your days: {{3}}

If you haven't answered yet, please do. Your page has the details.
```

Examples: Aoife · Nissan (Build) · Fri 2 Oct. Footer as above. One button:
Visit website, **See the details**, dynamic URL `https://<the app's address>/f/{{1}}`.

`job_cancelled`, Utility, English (UK):

```
Hi {{1}}, sorry: {{2}} isn't going ahead, so you're not needed on {{3}}. Those days are free again.
```

Examples as above. Footer as above, no buttons.

**Three more**, for what follows an offer: being booked, a new call time,
and no longer needed ([ADR 0154](adr/0154-whatsapp-tells-crew-what-happens-next.md)).
Each goes to anyone WhatsApp reaches who heard of the offer, whether or not
the offer itself went on WhatsApp. None of them names the rate.

`job_booked`, Utility, English (UK):

```
Hi {{1}}, you're booked for {{2}}.

Role: {{3}}
Days: {{4}}
Call time: {{5}}
Venue: {{6}}

Your page has the details.
```

Examples: Aoife · Electric Picnic (Build) · Audio tech · Fri 2 Oct · 08:00 ·
Stradbally Hall. Footer as above. One button: Visit website, **See the
details**, dynamic URL `https://<the app's address>/f/{{1}}`.

`job_call_time`, Utility, English (UK):

```
Hi {{1}}, the call time for {{2}} has changed.

Call time: {{3}}
Days: {{4}}

Your page has the details.
```

Examples: Aoife · Electric Picnic (Build) · 06:00 · Fri 2 Oct. Footer as
above. One button, as for `job_booked`. While the client hasn't said yes,
the job reads `HOLD Electric Picnic (Build)`, as in the offer.

`job_not_needed`, Utility, English (UK):

```
Hi {{1}}, sorry: you're no longer needed for {{2}} on {{3}} ({{4}}). Those days are free again.
```

Examples: Dara · Electric Picnic (Build) · Fri 2 Oct · filled by someone
else. The last blank is "filled by someone else" or "withdrawn by the
office", the words on their page. Footer as above, no buttons.

If crew invites on Google Calendar are on, add this line to the end of
`job_offer`'s body too: *We also send a Google Calendar invite for each day.
If it says it's from an unknown sender, press Add to calendar.*

Approval usually takes minutes. If Meta files it under Marketing instead of
Utility, ask for a review: it's an offer of work to someone who works for
Session Hire, about a job they're being booked for.

## 10. Try it, then turn it on

1. Under **Admin › Connections › Offers on WhatsApp**, put your own mobile in
   **Numbers to try it on**, save, and choose **Only to the numbers below**.
   Make sure you're a person in Crew with that mobile.
2. Offer yourself a call. The WhatsApp should arrive within a few seconds,
   and the offer's row in Crew says "sent", then "delivered" and "read".
   Press **Yes, I can do it**: the offer shows as accepted on WhatsApp, and
   you get a reply saying so. Try **No, I can't** on another, and write
   STOP to check it turns you off.
   For HOLD, offer yourself a call on a job that's still a quote: the job reads
   "HOLD …". Confirm the job for the follow-up, or cancel it.
   For what follows an offer, on a confirmed job: say yes, confirm yourself
   ("you're booked"), change the call time, then release yourself ("no
   longer needed").
3. When you're ready (launch), choose **On**. Everyone with a mobile gets
   their offers on WhatsApp from then on, unless they turn them off on their
   own page.
