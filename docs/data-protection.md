# Data protection: record of processing and breach plan

These are drafts of two documents GDPR expects the company to keep. They were written after the security check of
24 November 2026 ([ADR 0193](adr/0193-payment-details-kept-locked.md)), from what the app does, for a director to
read, correct and adopt. They are not legal advice: for the PPS number question in particular, check with the
accountant or a data protection adviser.

## Record of processing (GDPR article 30)

**Controller:** the company that trades as Session Hire. Its legal name, CRO number and registered office are under
Admin › Company. **Contact for data questions:** the office email set there.

| Who | What we keep | Why, and the lawful basis | Who sees it | How long |
| --- | --- | --- | --- | --- |
| **People who apply to join the crew** | Name, email, mobile, roles, day rate, how they trade, where they're based, what they say about their experience. Optionally their PPS number, VAT number and bank account, kept locked. | To decide whether to offer them work. Basis: steps they asked for before a contract (6(1)(b)). | Directors and the office. | Deleted when they're turned down, or after 6 months if nobody answers. |
| **Crew (freelancers)** | Name, contact details, roles, rates, offers and answers, bookings, days off, timesheets, documents such as certificates, running-late notes, optionally their own calendar's busy times. Payment details, as above. | To offer them work, run the jobs, and pay them. Basis: contract (6(1)(b)). Telling Revenue what was paid: legal obligation (6(1)(c)). | Directors and the office. Crew leading a job see the others' names and mobiles on it. Payment details masked for the office; in full for directors only, each time recorded. | While they're on the crew list. Payment details deleted when they leave it, or after 12 months with no booking or offer. Payment records 6 years (tax law). |
| **Staff** | As crew, with leave. | Employment contract. | Directors and the office. | While employed, then as employment law asks. |
| **Clients and their contacts** | Names, emails, phones, addresses, quotes, jobs. | To quote, run and bill jobs. Basis: contract. | Staff. | While the company deals with them, and 6 years for the money records. |

**PPS numbers.** Under section 262 of the Social Welfare Consolidation Act 2005 a business may keep one only for
dealing with Revenue or Social Protection about that person, such as payroll or Form 46G. Admin › Company ›
Applications to join › Ask for PPS numbers turns the question off everywhere if the accountant says the company won't
use them that way. They are never used to identify anyone.

**Where it's kept, and who processes it for us:**

| Service | What it does | Where | Agreement to have in place |
| --- | --- | --- | --- |
| Railway | Runs the app | EU West (Netherlands) | Railway's data processing agreement |
| Neon, through Vercel | The database and its backups | Frankfurt | Neon's and Vercel's data processing agreements |
| Google Workspace | Sign-in, email, calendars | EU and elsewhere under Google's EU clauses | Google's data processing terms (Admin console) |
| Sentry | Error reports, with nothing anyone typed | Should be the EU region: Admin › Status says whether it is | Sentry's data processing agreement |
| Current RMS | The old quotes and stock the app reads | Per Current RMS's terms | Current RMS's data processing agreement |
| Meta (WhatsApp), once turned on | Offers to crew who haven't turned it off | Meta's EU clauses | WhatsApp Business terms |

**How it's kept safe:**
- Payment details are locked with AES-256-GCM under a key that lives only in Railway's settings.
- Backups and Download everything hold only the locked form.
- Only signed-in staff can use the app, and the server holds back what each role doesn't need.
- Every change, and every full view of payment details, is in History.
- Everything is sent only over HTTPS.

## Breach plan

A breach is any time personal details are lost, seen by someone who shouldn't see them, or changed without
permission. Examples: a laptop or phone signed in to the app is stolen; a crew link is posted publicly; someone gets
into Railway, Neon or the Google account; the database or a backup is copied.

1. **Whoever notices tells a director at once**, by phone. The director decides from here.
2. **Stop it getting worse within the hour.**
   - Sign the lost device out: Admin › People › their sessions.
   - Ask the office for a new link for the person whose link leaked.
   - Change passwords, and turn on two-step sign-in where it's missing.
   - If the database and the payment details key could both have been taken, change the key at once. Put the current one in `PAYMENT_DETAILS_KEY_OLD` and a new random one in `PAYMENT_DETAILS_KEY`, and deploy.
3. **Write down what happened**, in one place: when it was noticed, what was exposed and about how many people, and what was done. History in the app shows who changed or looked at what.
4. **Report it to the Data Protection Commission within 72 hours** of noticing, at dataprotection.ie, unless it's unlikely to put anyone at risk. Bank details or PPS numbers exposed in a readable form count as a risk. If you don't yet know everything, report what you know and add the rest later.
5. **Tell the people affected without delay** if it's likely to put them at high risk, such as bank details or PPS numbers that could be read. Tell them in plain words what happened, what it means for them (for example, to watch for payments or emails asking them to change bank details), and who to contact.
6. **Afterwards**, note what would stop it happening again, and do it.

Keep this plan, and the record of every breach even if it wasn't reported, for the DPC to see if it asks.
