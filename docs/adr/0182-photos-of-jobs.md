# ADR 0182: Photos of jobs

- **Status:** accepted
- **Date:** 14 November 2026
- **Asked for by:** Colly, 14 November 2026: "Can you add a function to upload photos of an event? It would be good to
  keep a record of what they looked like for references, for referring to other clients examples etc. Is there any
  concerns about storage?"
- **Builds on:** [ADR 0029](0029-documents.md) (documents' files in the storage bucket), [ADR 0065](0065-a-photo-on-a-persons-page.md)
  and [ADR 0083](0083-product-photos-and-the-rack-sheet.md) (photos made smaller on the device before they're sent).

## Context

The company wants a record of what each show looked like: to look back on, and to show the next client what it can do.
Photos come from staff phones at the gig or after it, many at a time. A phone photo is 3 to 5 MB, and the company runs
hundreds of jobs a year.

The app already has somewhere to keep files: the storage bucket on Railway that holds the nightly backups, people's and
products' photos, the logo and documents (ADR 0029), at about $0.015 a GB a month. The database (Neon) is not the place
for pictures: it is backed up nightly as a whole, sent to every phone as changes, and costs more per GB.

## Decision

1. **Kept in the bucket, as documents' files are.** Each photo is two files under `documents/`: the photo, its longer
   side made 2,560 px on the phone (about 0.5 MB), and a small copy at 720 px (a few dozen KB) for the grids. Both are
   JPEG, so an iPhone's HEIC is turned into one on the phone, and where it was taken (its EXIF) stays behind. They are
   encrypted with BACKUP_KEY like every file there, read only through the server, and on the same list of files to
   delete: when a photo is taken down, or the company starts fresh. At 300 jobs a year with 20 photos each that is about
   3 GB a year, a few cents a month. No new service or account.
2. **The database holds what's said about each**: `job_photos`, with its job, caption, tags, size in pixels, bytes, who
   put it up and when. Devices are sent that as the `jobPhoto` record; the pictures come from
   `/api/job-photos/:id/thumb|full`, an address that never changes (a photo is never replaced, only taken down), so the
   browser keeps them, and the service worker keeps the small copies seen for two months, so a grid shows with no signal.
3. **Sent in one request with both copies**, the small one first and its length in the address, so a photo is never on
   a job without the copy its grid shows. Each is checked to be a JPEG by its first bytes.
4. **A Photos tab on each gig and dry hire**, last, as photos come after the show. Add photos opens the phone's camera
   or photo library with several at a time (up to 60), sent one after another, and
   what didn't go stays with why, to try again. Leaving the page while they're going asks first. Each photo opens whole
   over the page, steps to the next, takes its caption and tags there (Change caption and tags: Colly, 14 November 2026,
   moved them off the tab, where a form for the whole lot pushed the photos down), and Share or save sends it to the phone's share sheet (to WhatsApp or email a
   client) or saves it on a laptop. Errands and meetings have no Photos tab.
5. **Jobs › Photos** is every job's photos, newest show first, found by caption, tag, job, client or venue, with tags in
   Filter. It is also on the Menu.
6. **Who:** a new ability, `photos`, held by every staff role (director, office, head of department, staff crew): they
   put photos up and change captions and tags. Taking one down is for whoever put it up and the roles that change jobs.
   Everyone signed in sees them, freelancers too: they're the company's work, not anyone's details. Joining jobs moves
   the photos to the job kept; combining people moves who put them up; erasing someone leaves the photo, reading
   "Erased person".

## Consequences

- The bucket is the only copy of the photos. The nightly backup holds their captions and tags, not the pictures, as for
  documents. A second copy elsewhere (Google Drive, say) can be added later if wanted.
- A crowd shot can show people. The company decides which photos it shows clients; anyone asked can be taken out by
  taking the photo down.
- Download everything lists `job_photos` but not the pictures, as for documents.
