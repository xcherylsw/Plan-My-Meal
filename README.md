# Plan My Meals — website

- `yourproject.web.app/` — the app itself. Opening the link goes straight in, with About · Guides · Privacy · Contact along the top. "Add to Home Screen" gives it an icon.
- `/about.html`, `/guides/`, `/privacy.html`, `/contact.html` — public pages (plain HTML, readable by Google). Under the Generate screen the app also shows a short "What is Plan My Meals?" section, so the home page has real words on it for Google's reviewers.

The same app, as a website that works on laptop and phone browsers.
People sign in with Google and their plans, kitchen and recipes follow them
to any device automatically. A family shares one **household**: everyone in it
sees and edits the same plan, kitchen, recipes and shopping list, and changes
show up on everyone's screen within a couple of seconds. Nobody outside the
household can see its data.

- Without signing in, it still works — saved on that one device only.
- Signed in: saves automatically a second after every change, and loads
  on any other device (when the tab is opened/refocused, or "Refresh" in
  the account menu). If the same thing was changed on two devices, the most
  recent change wins.
- **Households:** everyone starts in their own private household. The
  person who owns it taps their picture (top right) → **Who can join**, adds
  each family member's Google email, then **Share** sends the household's code
  (looks like `ABCD-2345`). The family member signs in with that Google
  account, taps their picture → **Join a household**, and types the code. Both
  the code and the invited email must match, so a leaked code alone is not
  enough. Their device then shows the household's data. **Leave** gives
  someone a copy of everything in a new private household of their own (the
  owner can't leave while others are in it). Any member can still remove
  another member.
- A family member's change appears on your screen at a quiet moment — never
  while you're typing or just after you tapped something.
- Signing out removes the data from that device (it stays in the account) —
  safe on a shared computer.
- On a phone, "Add to Home Screen" gives it an app icon and full-screen view.

## One-time setup (about 10 minutes, free, no credit card)

You do this once. The people using the site never see any of it.

1. **Create the project.** Go to https://console.firebase.google.com →
   *Add project* → any name → turn Google Analytics off → *Create*.
2. **Turn on Google sign-in.** *Build → Authentication → Get started →
   Sign-in method → Google → Enable.* Pick your email as the support email.
   (On the *Settings* tab you can set the public-facing name people will see
   on the Google sign-in screen, e.g. "Plan My Meals".)
3. **Create the database.** *Build → Firestore Database → Create database →*
   region **asia-southeast1 (Singapore)** → *production mode*. Then open the
   *Rules* tab, replace everything with the contents of `firestore.rules`
   from this folder, and *Publish*. This is what keeps each household's data
   private — don't skip it. (If you set up an earlier version of this site,
   publish the new rules again: they changed for households.)
4. **Switch on Hosting.** *Build → Hosting → Get started* → click through
   the prompts (you don't need to run anything it shows).
5. **Copy the settings into the app.** *Project settings (gear icon) →
   General → Your apps → the web icon `</>` → register app* (any nickname,
   no hosting checkbox). Copy the `apiKey`, `authDomain`, `projectId`,
   `appId` into `src/firebaseConfig.js`. (They're not secrets.)
6. **Set the project id for deploys.** Edit `.firebaserc` and replace
   `YOUR_PROJECT_ID` with your project id.
7. **Let GitHub publish the site.** In Firebase: *Project settings →
   Service accounts → Generate new private key* (downloads a .json file).
   In your GitHub repo: *Settings → Secrets and variables → Actions → New
   repository secret*, name it `FIREBASE_SERVICE_ACCOUNT`, paste the whole
   contents of that .json file. Delete the downloaded file afterwards.
8. **Fill in `site.config.json`.** Put your email in `contactEmail` (it appears on the Contact and Privacy pages) and check the `privacyUpdated` date. Leave the AdSense lines empty for now.
9. **Push this folder to the repo's `main` branch.** The *Deploy website*
   action builds and publishes. Your site is at
   `https://YOUR_PROJECT_ID.web.app` (first run takes a couple of minutes).

10. **Turn on the recipe library (admin).** Two edits, both with the Google address you sign in with:
    - `src/firebaseConfig.js` → set `ADMIN_EMAIL`.
    - `firestore.rules` → replace `YOUR_ADMIN_EMAIL` (in the `library` block), then paste the whole file into *Firestore → Rules → Publish* again.

    Push, open the site, sign in, and a **Library** tab appears with a "New library recipe" button that only your account sees. Everyone else can browse the library and tap *Add to my recipes*. Each recipe can carry the creator's name, a link to their page and a link to the original video; these show wherever the recipe appears. Write recipes in your own words and link to the video rather than copying it.

Changing the app later: push again, same thing.

## Good to know

- **WhatsApp / Instagram / Facebook in-app browsers** block Google sign-in.
  If someone taps your link in one of those and sign-in fails, they need to
  open it in Chrome or Safari (the app shows a hint). Worth saying when you
  share the link.
- **Own domain** (e.g. planmymeals.com): add it under *Hosting → Add custom
  domain*, then add the same domain under *Authentication → Settings →
  Authorized domains*.
- **Cost:** the free plan comfortably covers a few hundred regular users for
  an app like this. If it grows, Firebase shows usage on the console's
  Usage tab, and you can set a budget alert.
- **Privacy:** you'll be holding people's meal data and Google email
  addresses. Put a short privacy note on wherever you share the link — what
  is stored (meal plans, kitchen items, recipes, email), that it's private to
  them, and how to ask for deletion (delete their household in the Firestore console, under `households`).
- **Run it on your own computer** (optional): `npm install`, then `npm run dev`; open `/` for the app.

## How the code is laid out

- `src/MakanLedger.jsx` — the app itself.
- `src/cloud.js` — saving on the device + automatic sync + households + sign-in/out.
- `src/AccountBar.jsx` — the sign-in button / account menu / household sharing.
- `src/main.jsx` — starts everything; `src/ads.js` — the ad slot and page footer; `app/index.html` — the app's page.
- `firestore.rules`, `firebase.json`, `.firebaserc` — Firebase configuration.

## Ads (Google AdSense) — switched off until you add your details

Ads are built in but do nothing until you fill in `site.config.json`. Order that works:

1. **Launch without ads first**, on a domain you own if you can (e.g. buy
   `planmymeals.com`, add it under Firebase *Hosting → Add custom domain*, and
   under *Authentication → Settings → Authorized domains*). I can't promise
   AdSense accepts a `.web.app` address; a domain of your own is the safer bet.
2. Fill in `contactEmail` and make sure the Privacy, About, Contact pages and
   the three guides read well. AdSense reviews the public pages — they need to
   be real, useful content, and they are. Add more guides over time; sites with
   a handful of genuine articles are approved far more often than one-screen apps.
3. Apply at https://adsense.google.com with your site's address. Approval can
   take days to weeks and may be refused at first; if so, the reason is shown,
   and adding more original pages is the usual fix. Review Google's current
   program policies before you apply — they change.
4. After approval: in AdSense, create two **Display ad** units (one for the
   content pages, one for inside the app). Copy your publisher ID
   (`ca-pub-…`) and the two slot IDs into `site.config.json`
   (`adsensePublisherId`, `adsenseContentSlot`, `adsenseAppSlot`). Push. Ads
   appear on About, the Guides and at the bottom of the app's
   Generate and List screens — never on Privacy or Contact, and never next to
   buttons.
5. In AdSense, open *Privacy & messaging* and turn on the consent message for
   the European Economic Area and UK. This is required if anyone from there
   can visit, and AdSense shows it for you — no code needed.
6. The `ads.txt` file is created for you from your publisher ID.

Not supported on the web: the phone version's full-screen ad after pressing
Generate. AdSense doesn't offer that format for websites.

The privacy page already mentions Google ads; if you decide never to show ads,
delete section 4 of `site/privacy.html`.

## Files you edit

- `site.config.json` — your email and (later) AdSense IDs.
- `src/firebaseConfig.js` — your Firebase settings.
- `.firebaserc` — your Firebase project ID.
- `site/*.html` — the public pages. The `public/` folder is generated from `site/`; edit `site/`, not `public/`.
