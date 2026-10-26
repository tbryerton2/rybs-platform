# Booking navigation browser regression

This isolated Next.js app imports the production navigation guard, completion tracker,
entry listener, and session helpers. Checkout is simulated locally: no API calls,
bookings, email, payment, or database changes occur. The fixture is outside `src/app`
and is never deployed with the retail app.

From the repository root:

```sh
npm run build --prefix tests/fixtures/booking-navigation
npm run start --prefix tests/fixtures/booking-navigation
```

Open `http://localhost:3107` in a browser and check:

1. Choose **Start new booking**, then **Continue to checkout**. Before completion,
   browser Back and Forward should still show the booking steps.
2. Choose **Discard custom history metadata**, then **Complete simulated booking**.
   Browser Back from confirmation must show **Retail homepage**, never **Service ZIP**.
   This reproduces the failure in the first release without relying on a mocked router.
3. Repeat using **Complete with older checkout code**. Refresh the confirmation page,
   then use Back. It must still show the homepage.
4. After completion, use **Book again** on the homepage. The ZIP page must open.
5. Start and complete another booking. Older booking steps remain closed on Back.

**Inspect navigation** displays the current history marker and saved completion state.
Use a new browser tab for a new independent session.
