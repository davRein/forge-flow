# REST collections and compact Dev Tools

The JSON formatter uses a narrower page, smaller controls and shorter editors. Its
indentation selector and action buttons align at the bottom. JSON formatting still
preserves large numbers and duplicate keys. Shared Dev Tools spacing is reduced.

The REST client has a collection sidebar and a compact method/URL/Send row. Headers,
request body and timeout have separate keyboard-accessible tabs. On narrow screens
the sidebar moves above the editor and the request row wraps.

## Using collections

1. Create a named collection with the sidebar **+**, or choose a new collection when
   saving a request. An empty collection is allowed.
2. Enter a method, URL, headers, body type/body and timeout, then choose **Save**.
   The save dialog asks for a request name and collection. A green notification
   appears only after storage confirms the change.
3. Click a saved request to load its inputs. Loading and saving never send that
   request to its destination. Only **Send request** performs the browser request.
4. **Save** updates a loaded request; **Save as…** creates a separate request.
   Search matches collection names, request names and URLs. Collections can be
   collapsed, renamed or deleted. Deleting a collection deletes its saved requests.
5. Deletion requires confirmation. Replacing an unsaved editor draft requires a
   separate confirmation. A failed save keeps the dialog and draft with its reason.

Requests store raw header/body text, including unfinished JSON and an empty URL.
Filled URLs must use HTTP(S) without embedded credentials. Sending additionally
validates the draft using the existing REST client validation. Responses, application
cookies and request history are not stored. This is a grouped request library;
Postman file import/export, nested folders, scripts and environments are not included.

## Private account storage

API mode uses `GET/PUT /api/v1/me/rest-collections`. The authenticated active account
is the owner; clients cannot select another owner. Definitions are outside the
workspace, global settings and AI tool data, because headers and bodies may contain
credentials. They are stored as private account data in the application database,
without application-level encryption. They are not placed in browser localStorage.

PostgreSQL migration **V9** creates `ff_rest_collections` with an account foreign key,
revision and JSON text payload. It runs automatically at backend startup. No new
environment variables or dependencies are required. Existing workspace replacement
does not delete these records. A fresh backend instance reads committed definitions.
The memory profile retains them only until backend restart; local frontend preview
retains them only in the current session. Signing out clears mounted private state.

PUT replaces the complete collection document atomically. Version is `1`; the body
revision and quoted `If-Match` must agree. Missing header returns 428; a changed
server revision returns 409. Save attempts are never replayed automatically. Reload
explicitly after a conflict and then load the changed request or save a separate copy.
The collection store preserves the last confirmed document on failure and never
falls back to example data in API mode.

Limits per account: 100 collections, 1,000 requests in total, 1 MiB serialized UTF-8.
Names: 200 characters; URL: 4,000; headers: 20,000; body: 100,000; timeout: 1–120 seconds.
Collection and request IDs are globally unique UUIDs within that account document.
Structural limits return 400, semantic errors 422, size overflow 413. Storage failures
use the existing safe 503 response without reflecting headers or bodies.

The server stores definitions only. Sending remains a direct browser fetch with
CORS, omitted cookies, no referrer, cancellation/timeout and a 2 MiB response limit.
There is no server-side HTTP proxy. New clients require the new backend endpoint;
an older backend returns a load error instead of silently switching storage modes.
An old backend does not read V9 data. Do not manually delete migrations or rows to
downgrade; preserve a database backup before replacing the server artifact.

## Verification

Automated coverage checks raw Unicode/large-number draft preservation, validation
and byte limits, account authentication/CSRF/origin, revisions/conflicts, isolation
from workspace updates, database restart persistence, concurrent first writes and
transaction rollback. Frontend tests exercise save/update/copy/rename/delete,
unsaved draft confirmation, lazy loading/retry, failed saves and keyboard tabs.

Visual desktop/mobile browser acceptance remains manual; see [browser-check.md](browser-check.md).
